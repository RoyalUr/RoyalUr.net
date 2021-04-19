#
# Compile the RoyalUr website into a smaller, coherent unit.
#

import os
import sys
import json
import time
import math
import shlex
import subprocess
import shutil
from PIL import Image as PILImage
from datetime import datetime
import xml.etree.ElementTree as ElementTree


#
# When we make a mistake and need to destroy everyone's caches, update this mod time.
# Updating this will cause ALL assets versions to be upped to at least this value.
#
CACHE_DESTRUCTION_MOD_TIME = 1614055952


#
# Utility Functions
#

def resolve_path(root_dir, path):
    """
    Similar to os.path.join, except that it acts like a webserver for paths beginning with "/".
    This means that a preceding slash "/" is treated as a "./".
    """
    if os.path.isabs(path):
        path = os.path.relpath(path, start=os.path.abspath(os.sep))
    return os.path.join(root_dir, path)

def getmtime(files):
    # If files is a list of files, get the maximum modification time of all the files.
    if isinstance(files, list):
        return max([getmtime(file) for file in files])

    # Otherwise, get the modification time of the single file.
    try:
        return math.floor(os.path.getmtime(files))
    except FileNotFoundError:
        return -1


def setmtime(file, mtime):
    os.utime(file, (time.time(), mtime))


def get_incomplete_file_mtime(file):
    """ Supports the finding of modification times for images without their extensions. """
    potentials = [file, file + ".png", file + ".webp"]
    for potential_file in potentials:
        if os.path.exists(potential_file):
            return getmtime(potential_file)
    raise Exception("Could not find version of file {}".format(file))


def append_size_class(path, size_class):
    if size_class == "u_u":
        return path
    return "{}.{}".format(path, size_class)


def execute_command(*command, **kwargs):
    return execute_piped_commands(command, **kwargs)


def execute_piped_commands(*commands, prefix="", output_prefix=" -- "):
    """
    Executes the given commands where the output of each is piped to the next.
    The last command can be a string filename, in which case the final output will be written to the file.
    Returns whether execution was successful.
    """
    # See if the command output should be piped to a file.
    output_file = None
    if isinstance(commands[-1], str):
        output_file = commands[-1]
        commands = commands[:-1]

    processes = []
    last_process = None
    for index in range(len(commands)):
        command = " ".join([shlex.quote(arg) for arg in commands[index]])
        if index == len(commands) - 1 and output_file is not None:
            command += " > " + output_file

        print(prefix + (" | " if index > 0 else "") + command)
        previous_output = (None if last_process is None else last_process.stdout)
        last_process = subprocess.Popen(
                command, stdin=previous_output, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
        processes.append(last_process)

    try:
        stdout, stderr = last_process.communicate()
        stdout = ("" if stdout is None else stdout.decode('utf-8').strip())
        stderr = ("" if stderr is None else stderr.decode('utf-8').strip())
        code = last_process.returncode
        if stdout != "":
            print(output_prefix + stdout.replace("\n", "\n" + output_prefix))
        if stderr != "":
            print(output_prefix + stderr.replace("\n", "\n" + output_prefix), file=sys.stderr)
        if code < 0:
            print(prefix + "Execution of", commands[-1], "was terminated by signal:", -code, file=sys.stderr)
        elif code != 0:
            print(prefix + "Command", commands[-1], "resulted in the non-zero return code:", code, file=sys.stderr)
        return code == 0
    except OSError as error:
        print(prefix + "Execution of", commands[-1], "failed:", error, file=sys.stderr)
        return False


#
# Compilation Specification
#

class CompilationSpec:
    def __init__(self, spec_json):
        sitemap_spec = spec_json["sitemap"]
        self.sitemap_source = sitemap_spec["source"]
        self.sitemap_dest = sitemap_spec["dest"]

        self.html_files = spec_json["html"]
        self.css_files = spec_json["css"]
        self.js_files = spec_json["javascript"]
        self.res_files = spec_json["resources"]
        self.annotation_files = spec_json["annotations"]

        self.image_size_classes = {}
        for spec, name in spec_json["image_size_classes"].items():
            self.image_size_classes[spec] = ImageSizeClass(spec, name)

        self.image_size_groups = {}
        for name, size_specs in spec_json["image_size_groups"].items():
            self.image_size_groups[name] = ImageSizeGroup(name, size_specs)

        self.images = {}
        for from_rel, spec in spec_json["images"].items():
            image = Image(from_rel, spec)
            self.images[from_rel] = image
            if image.size_group is not None:
                if image.size_group not in self.image_size_groups:
                    raise Exception("Unknown size group {} for image {}".format(image.size_group, from_rel))
                image.sizes = self.image_size_groups[image.size_group]

    @staticmethod
    def read(file):
        with open(file, 'r') as f:
            spec_json = json.load(f)
        return CompilationSpec(spec_json)


class ImageSizeClass:
    def __init__(self, spec, name):
        self.spec = spec
        self.name = name
        spec_wh = spec.split("_", 2)
        self.width = -1 if spec_wh[0] == "u" else int(spec_wh[0])
        self.height = -1 if spec_wh[1] == "u" else int(spec_wh[1])


class ImageSizeGroup:
    def __init__(self, name, spec):
        self.name = name
        self.sizes = {}
        for size_class, size_spec in spec.items():
            self.sizes[size_class] = ImageSize(size_spec)
        # Each size group should contain the original copy size.
        if "u_u" not in self.sizes:
            self.sizes["u_u"] = ImageSize("auto x auto")

    def __getitem__(self, key):
        return self.sizes[key]

    def keys(self):
        return self.sizes.keys()

    def values(self):
        return self.sizes.values()

    def items(self):
        return self.sizes.items()


class ImageSize:
    def __init__(self, spec):
        self.spec = spec
        spec_wh = spec.split("x", 2)
        w = spec_wh[0].strip()
        h = spec_wh[1].strip()
        self.width = -1 if w == "auto" else int(w)
        self.height = -1 if h == "auto" else int(h)

    def calc_width(self, original_width, original_height):
        if self.width > 0:
            return self.width
        if self.height <= 0:
            return original_width
        return int(original_width * self.height / original_height)

    def calc_height(self, original_width, original_height):
        if self.height > 0:
            return self.height
        if self.width <= 0:
            return original_height
        return int(original_height * self.width / original_width)


class Image:
    def __init__(self, from_rel, spec):
        self.from_rel = from_rel
        self.to_rel = spec["dest"] if "dest" in spec else None
        self.compression_quality = float(spec["compression_quality"]) if "compression_quality" in spec else 99
        self.size_group = spec["size_group"] if "size_group" in spec else None
        self.sizes = None
        # If no size group is given, it must be directly specified.
        if "sizes" in spec:
            if self.size_group is not None:
                raise Exception("Cannot specify both a size_group and sizes")
            self.sizes = ImageSizeGroup("Direct:" + from_rel, spec["sizes"])
        elif self.size_group is None:
            raise Exception("Must specify either a size_group or sizes")

        # May be populated later.
        self.original_image = None

    def get_original(self):
        if self.original_image is None:
            self.original_image = PILImage.open(self.from_rel)
        return self.original_image

    def get_scaled(self, size):
        original = self.get_original()
        width = size.calc_width(*original.size)
        height = size.calc_height(*original.size)
        return original.resize((width, height), PILImage.LANCZOS)

    def save_image_copies(self, target_folder, *, prefix=""):
        original = self.get_original()
        mtime = getmtime(self.from_rel)

        # Make sure the directory to copy the image to exists.
        output_file = resolve_path(target_folder, self.to_rel)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        # Create the scaled copies.
        for size_class, size in self.sizes.items():
            # Check if the scaled copy already exists.
            scaled_file = append_size_class(output_file, size_class)
            scaled_file_png = scaled_file + ".png"
            scaled_file_webp = scaled_file + ".webp"
            if mtime == getmtime(scaled_file_png) and mtime == getmtime(scaled_file_webp):
                continue

            # Save the scaled copies.
            quality = self.compression_quality
            lossless = (quality >= 100)

            scaled_image = self.get_scaled(size)
            scaled_image.save(scaled_file_png, lossless=lossless, quality=quality)
            setmtime(scaled_file_png, getmtime(self.from_rel))
            print("{}created {}".format(prefix, scaled_file_png))
            scaled_image.save(scaled_file_webp, lossless=lossless, quality=quality)
            setmtime(scaled_file_webp, getmtime(self.from_rel))
            print("{}created {}".format(prefix, scaled_file_webp))



#
# Perform Compilation
#

class Annotations:
    def __init__(self):
        self.annotations = {}
        self.source_files = []

    def add(self, key, annotations, source_file):
        """ The source file is used to determine the last modification time of the annotations. """
        if key not in self.annotations:
            self.annotations[key] = annotations
        else:
            self.annotations[key].update(annotations)
        self.source_files.append(source_file)

    def read(self, key, file):
        with open(file, 'r') as f:
            self.add(key, json.load(f), file)

    def write(self, file):
        with open(file, 'w') as f:
            json.dump(self.annotations, f, separators=(',', ':'))
        setmtime(file, getmtime(self.source_files))


def create_sitemap(target_folder, comp_spec, *, prefix=""):
    """
    Reads the sitemap template, fills in the last modified time, and outputs it.
    """
    date_w3c = datetime.now().strftime("%Y-%m-%d")
    with open(comp_spec.sitemap_source) as source_file:
        output_sitemap = ""
        for line in source_file:
            output_sitemap += line.replace("<lastmod/>", "<lastmod>" + date_w3c + "</lastmod>")

    dest = resolve_path(target_folder, comp_spec.sitemap_dest)
    with open(dest, "w") as dest_file:
        dest_file.write(output_sitemap)


def filter_html(file, *, prefix=""):
    """
    Filter the HTML file at source_path and resolve its include statements.
    """
    # We want the modification times when skipping versions
    # to be different than when including versions.
    source_mtime = getmtime(file)
    with open(file, 'r') as f:
        original_content = f.read()

    # Filter out <include>'s in the file.
    last_index = 0
    filtered = ""
    changed = False
    while True:
        # Search for the next <include> to replace.
        try:
            current_index = original_content.index("<include", last_index)
            changed = True
        except ValueError:
            # If there are is nothing more to replace, break out from the loop.
            filtered += original_content[last_index:]
            break

        # Add the content up to the <include> tag.
        filtered += original_content[last_index:current_index]
        try:
            last_index = original_content.index("/>", current_index) + len("/>")
        except ValueError:
            raise Exception("Found \"<include\" in file, but no closing \"/>\"")

        # Parse the include tag.
        node = ElementTree.fromstring(original_content[current_index:last_index])
        src_path = node.get("src")

        # Include the src file.
        try:
            include_mtime, include_content, include_changed = filter_html(src_path, prefix=prefix)
        except FileNotFoundError as e:
            raise Exception("Include not found while filtering {}: {}".format(file, str(e)))

        source_mtime = max(source_mtime, include_mtime)
        filtered += include_content

    return source_mtime, filtered, changed


def generate_html(target_folder, comp_spec, *, prefix=""):
    """
    Copies all of the HTML files to the target folder.
    """
    for from_path, to_rel in comp_spec.html_files.items():
        to_path = resolve_path(target_folder, to_rel)
        try:
            file_mtime, filtered, changed = filter_html(from_path, prefix=prefix)
        except FileNotFoundError as e:
            raise Exception("Unable to generate {}: {}".format(to_rel, str(e)))

        # Write the new filtered file.
        os.makedirs(os.path.dirname(to_path), exist_ok=True)
        if changed:
            with open(to_path, 'w') as file:
                file.write(filtered)
            setmtime(to_path, file_mtime)
            print(prefix + "generated " + to_path)


def combine_js(target_folder, comp_spec, *, prefix="", minify=False):
    """
    Concatenate all javascript into a single source file, and optionally minify it.
    """
    for to_rel, file_list in comp_spec.js_files.items():
        output_file = resolve_path(target_folder, to_rel)
        source_mtime = getmtime(file_list)
        # Skip this output if none of its sources have changed.
        if source_mtime == getmtime(output_file):
            continue

        commands = [["npx", "babel", "--presets=@babel/env", *file_list]]
        if (minify):
            commands.append(["uglifyjs", "--compress", "--mangle"])
        commands.append(output_file)

        assert execute_piped_commands(*commands, prefix=prefix)
        setmtime(output_file, source_mtime)


def minify_css(target_folder, comp_spec, *, prefix=""):
    """
    Minify the CSS of the website.
    """
    for to_rel, file_list in comp_spec.css_files.items():
        output_file = resolve_path(target_folder, to_rel)
        source_mtime = getmtime(file_list)
        # Skip this output if none of its sources have changed.
        if source_mtime == getmtime(output_file):
            continue

        assert execute_piped_commands(
            ["npx", "uglifycss", *file_list],
            output_file,
            prefix=prefix
        )
        setmtime(output_file, source_mtime)


def copy_resource_files(target_folder, comp_spec, *, prefix=""):
    """
    Copy all the resource files for the page into the target folder.
    """
    # Copy static files.
    for from_path, to_rel in comp_spec.res_files.items():
        to_path = resolve_path(target_folder, to_rel)
        if getmtime(from_path) <= getmtime(to_path):
            continue

        os.makedirs(os.path.dirname(to_path), exist_ok=True)
        shutil.copyfile(from_path, to_path)
        setmtime(to_path, getmtime(from_path))
        print("{}copied {}".format(prefix, to_rel))

    # Copy and scale images.
    for from_rel, image in comp_spec.images.items():
        if image.to_rel is not None:
            image.save_image_copies(target_folder, prefix=prefix)

    # Create the favicon images.
    favicon_image = PILImage.open("res/favicon.png")
    favicon_path = resolve_path(target_folder, "favicon{}.ico")
    target_sizes = [16, 32, 64, 96, 128]
    for size in target_sizes:
        favicon_scaled = favicon_image.resize((size, size), PILImage.LANCZOS)
        favicon_scaled.save(
            favicon_path.format(size), sizes=[(size, size)], lossless=True, quality=100
        )
        if size == max(target_sizes):
            favicon_scaled.save(
                favicon_path.format(""), sizes=[(size, size) for size in target_sizes],
                lossless=True, quality=100
            )


def combine_annotations(target_folder, comp_spec, *, prefix=""):
    """
    Combine all resource annotations into their own file.
    """
    annotations = Annotations()
    for key, file in comp_spec.annotation_files.items():
        annotations.read(key, file)
    annotations.write(resolve_path(target_folder, "res/annotations.json"))


def filter_file(target_folder, file, *, prefix="", skip_versions=False):
    """
    Filters through all HTML, CSS, and JS files and replaces [ver] patterns in file paths.
    :return: The filtered content of the file, and its calculated modification time.
    """
    # We want the modification times when skipping versions
    # to be different than when including versions.
    source_mtime = getmtime(file) + (0 if skip_versions else 1)
    with open(file, 'r') as f:
        original_content = f.read()

    # Filter out all [ver]'s in the file.
    last_index = 0
    filtered = ""
    changed = False
    while True:
        # Search for the next [ver] to replace.
        try:
            current_index = original_content.index(".[ver]", last_index)
            changed = True
        except ValueError:
            # If there are no more [ver]'s to replace, break out from the loop.
            filtered += original_content[last_index:]
            break

        # Add the content up to the [ver] tag.
        filtered += original_content[last_index:current_index]
        last_index = current_index + len(".[ver]")

        # Find the filename that the [ver] is embedded in.
        try:
            string_start = original_content.rindex("\"", 0, current_index)
            string_end = original_content.index("\"", last_index)
        except ValueError:
            raise Exception("Found [ver] outside of string in file {}".format(file_path))

        ver_target_file = original_content[string_start + 1:string_end].replace(".[ver]", "")
        if ver_target_file.startswith("https://royalur.net/"):
            ver_target_file = ver_target_file[len("https://royalur.net/"):]

        # Find the modification time of the resource that we are versioning.
        incomplete_path = resolve_path(target_folder, ver_target_file)
        version_mtime = get_incomplete_file_mtime(incomplete_path)

        # In dev builds we don't add the versions to the URLs.
        if not skip_versions:
            active_version = int(max(version_mtime, CACHE_DESTRUCTION_MOD_TIME))
            filtered += ".v{}".format(active_version)
            source_mtime = max(source_mtime, version_mtime)

        # Append the rest of the file name to the filtered file.
        filtered += original_content[last_index:string_end + 1]
        last_index = string_end + 1

        # Check if this is a dynamic image or a dynamic button.
        is_dyn_image = (original_content[string_start - len("data-src="):string_start] == "data-src=")
        is_dyn_button = (original_content[string_start - len("data-src-active="):string_start] == "data-src-active=")

        # Add a placeholder SVG image to maintain the aspect ratio of dynamic images.
        if is_dyn_image:
            image = PILImage.open(incomplete_path + ".png")
            filtered += " src=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 "
            filtered += str(image.width) + " " + str(image.height)
            filtered += "'%3E%3C/svg%3E\" "

        # Add the width and height to preserve the aspect ratio of dynamic images and buttons.
        if is_dyn_image or is_dyn_button:
                image = PILImage.open(incomplete_path + ".png")
                filtered += "width=\"" + str(image.width) + "\" "
                filtered += "height=\"" + str(image.height) + "\""

    return source_mtime, filtered, changed


def filter_files(target_folder, comp_spec, *, prefix="", skip_versions=False):
    """
    Filters through all HTML, CSS, and JS files and replaces [ver]
    patterns in file paths with their last modification time.
    Also adds placeholder SVG src attributes for dynamic images.
    """
    # The order here is important!!
    # The HTML files reference the CSS and JS files so they must be created first.
    files_to_filter = [
        *comp_spec.css_files.keys(),
        *comp_spec.js_files.keys(),
        *comp_spec.html_files.values()
    ]
    for file_rel in files_to_filter:
        # Read and filter the file.
        file_path = resolve_path(target_folder, file_rel)
        file_mtime, filtered, changed = filter_file(
                target_folder, file_path, prefix=prefix, skip_versions=skip_versions)

        # Write the new filtered file.
        if changed:
            with open(file_path, 'w') as file:
                file.write(filtered)
            setmtime(file_path, file_mtime)
            print(prefix + "filtered " + file_path)


def zip_development_res_folder(target_folder, comp_spec, *, prefix=""):
    """
    Creates a zip file with the full contents of the development resources folder.
    """
    output_file = resolve_path(target_folder, "res.zip")
    # For some reason the zip command never exits if shell=True is used in subprocess.Popen...
    assert execute_command("zip", "-q", "-r", output_file, "./res", prefix=prefix)


def download_development_res_folder(*, prefix=""):
    """
    Downloads and unzips the development resources folder from https://royalur.net/res.zip.
    """
    assert not os.path.exists("./res"), "The ./res directory already exists"
    assert not os.path.exists("./res.zip"), "The ./res.zip archive already exists"
    assert execute_command("wget", "-q", "https://royalur.net/res.zip", "-O", "./res.zip", prefix=prefix)
    try:
        assert execute_command("unzip", "-q", "./res.zip", "res/*", prefix=prefix)
    finally:
        assert execute_command("rm", "-f", "./res.zip", prefix=prefix)


def install_dependencies(*, prefix=""):
    """
    Installs the NPM dependencies required for this script to run.
    """
    assert execute_command("npm", "install", prefix=prefix)



#
# Create the different types of builds.
#

def create_release_build(target_folder):
    print("\nCompiling Release Build")
    comp_spec = CompilationSpec.read("compilation.json")
    print("\n1. Create a Sitemap")
    create_sitemap(target_folder, comp_spec, prefix=" .. ")
    print("\n2. Generate HTML")
    generate_html(target_folder, comp_spec, prefix=" .. ")
    print("\n3. Combine & Minify Javascript")
    combine_js(target_folder, comp_spec, prefix=" .. ", minify=True)
    print("\n4. Minify CSS")
    minify_css(target_folder, comp_spec, prefix=" .. ")
    print("\n5. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=" .. ")
    print("\n6. Create Annotations File")
    combine_annotations(target_folder, comp_spec, prefix=" .. ")
    print("\n7. Perform File Filtering")
    filter_files(target_folder, comp_spec, prefix=" .. ")
    print("\n8. Zip Development Resources Folder")
    zip_development_res_folder(target_folder, comp_spec, prefix=" .. ")


def create_dev_build(target_folder):
    print("\nCompiling Development Build")
    comp_spec = CompilationSpec.read("compilation.json")
    print("\n1. Create a Sitemap")
    create_sitemap(target_folder, comp_spec, prefix=" .. ")
    print("\n2. Generate HTML")
    generate_html(target_folder, comp_spec, prefix=" .. ")
    print("\n3. Combine Javascript")
    combine_js(target_folder, comp_spec, prefix=" .. ")
    print("\n4. Minify CSS")
    minify_css(target_folder, comp_spec, prefix=" .. ")
    print("\n5. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=" .. ")
    print("\n6. Create Annotations File")
    combine_annotations(target_folder, comp_spec, prefix=" .. ")
    print("\n7. Perform File Filtering")
    filter_files(target_folder, comp_spec, prefix=" .. ", skip_versions=True)



#
# Run the Compilation
#
def exit_with_usage():
    """ Prints the program help and then exits. """
    print("Usage:")
    print("  python -m compile [clean] <clean:dev:release>")
    sys.exit(1)


if __name__ == "__main__":
    # Read the program arguments.
    arg_count = len(sys.argv)
    if arg_count <= 1 or arg_count >= 4:
        exit_with_usage()

    mode = sys.argv[1]
    do_clean = (mode == "clean" or mode == "release")
    target_folder = "./compiled"
    if arg_count == 3:
        if mode != "clean":
            exit_with_usage()
        mode = sys.argv[2]

    # Check that the requested compilation mode exists.
    if mode != "release" and mode != "dev" and mode != "clean":
        print("Invalid compilation mode:", mode)
        exit_with_usage()

    # Download the resources folder if it doesn't exist.
    if not os.path.exists("./res"):
        print("\nCould not find ./res directory, attempting to download it...")
        download_development_res_folder(prefix=" .. ")

    # Create the target directory if it doesn't already exist.
    if not do_clean and not os.path.exists(target_folder):
        print("\nCould not find the target directory, " + target_folder + ", creating it...")
        os.mkdir(target_folder)

    # Install the NPM dependencies if they are not already installed.
    if not os.path.exists("./node_modules"):
        print("\nDetected missing NPM dependencies as ./node_modules is missing, installing them...")
        install_dependencies(prefix=" .. ")

    # If needed, perform a clean of the target directory.
    if do_clean:
        print("\nCleaning the target directory " + target_folder + "...")
        shutil.rmtree(target_folder)
        os.makedirs(target_folder)

    # Start the compilation.
    if mode == "release":
        create_release_build(target_folder)
    elif mode == "dev":
        create_dev_build(target_folder)

    print("\nDone!\n")
