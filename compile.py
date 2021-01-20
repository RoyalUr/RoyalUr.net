#
# Compile the RoyalUr website into a smaller, coherent unit.
#

import os
import sys
import json
import time
import math
import subprocess
import shutil
from PIL import Image as PILImage
from datetime import datetime


#
# Utility Functions
#

def getmtime(filename):
    try:
        return math.ceil(os.path.getmtime(filename))
    except FileNotFoundError:
        return -1


def get_incomplete_file_mtime(file):
    """ Supports the finding of modification times for images without their extensions. """
    potentials = [file, file + ".png", file + ".webp"]
    for potential_file in potentials:
        if os.path.exists(potential_file):
            return os.path.getmtime(potential_file)
    raise Exception("Could not find version of file {}".format(file))


def set_mtime(file, mtime):
    os.utime(file, (time.time(), mtime))


def update_mtime(file, source_files):
    if not isinstance(source_files, list):
        raise Exception("Expected list of source files")
    latest_mtime = -1
    for source_file in source_files:
        latest_mtime = max(latest_mtime, getmtime(source_file))
    set_mtime(file, latest_mtime)


def append_size_class(path, size_class):
    if size_class == "u_u":
        return path
    return "{}.{}".format(path, size_class)


def execute_command(*command, **kwargs):
    return execute_piped_commands(command, **kwargs)


def execute_piped_commands(*commands, prefix="", output_prefix=" -- ", use_shell=True):
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

    last_process = None
    for index in range(len(commands)):
        command = commands[index]
        command_print = (" | " if index > 0 else "") + " ".join(command)

        pipe_out = subprocess.PIPE
        if index == len(commands) - 1 and output_file is not None:
            pipe_out = open(output_file, 'w')
            command_print += " > " + output_file

        print(prefix + command_print)
        previous_output = (None if last_process is None else last_process.stdout)
        last_process = subprocess.Popen(
            command, stdin=previous_output, stdout=pipe_out, stderr=subprocess.STDOUT,
            shell=use_shell, close_fds=True)

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

        css_spec = spec_json["css"]
        self.css_source = css_spec["source"]
        self.css_dest = css_spec["dest"]

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

        self.sprites = {}
        for to_rel, input_images in spec_json["sprites"].items():
            images = []
            for image_from_rel in input_images:
                if image_from_rel not in self.images:
                    raise Exception("Unknown image {} for sprite {}".format(image_from_rel, to_rel))
                images.append(self.images[image_from_rel])
            self.sprites[to_rel] = Sprite(to_rel, images)

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
        output_file = os.path.join(target_folder, self.to_rel)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        # Create the scaled copies.
        for size_class, size in self.sizes.items():
            # Check if the scaled copy already exists.
            scaled_file = append_size_class(output_file, size_class)
            scaled_file_png = scaled_file + ".png"
            scaled_file_webp = scaled_file + ".webp"
            if mtime <= getmtime(scaled_file_png) and mtime <= getmtime(scaled_file_webp):
                continue

            # Save the scaled copies.
            scaled_image = self.get_scaled(size)
            scaled_image.save(scaled_file_png)
            update_mtime(scaled_file_png, [self.from_rel])
            print("{}created {}".format(prefix, scaled_file_png))
            scaled_image.save(scaled_file_webp)
            update_mtime(scaled_file_webp, [self.from_rel])
            print("{}created {}".format(prefix, scaled_file_webp))


class Sprite:
    def __init__(self, to_rel, images):
        self.to_rel = to_rel
        self.images = images
        self.image_from_rels = []
        size_classes = self.get_size_classes()
        for image in images:
            self.image_from_rels.append(image.from_rel)
            if image.sizes.keys() != size_classes:
                raise Exception("Images have inconsistent sets of size classes")

    def get_mod_time(self):
        return min(getmtime(image.from_rel) for image in self.images)

    def get_size_classes(self):
        return set().union(*(image.sizes.keys() for image in self.images))

    def save_sprite_copies(self, target_folder, *, prefix=""):
        mtime = self.get_mod_time()

        # Make sure the directory to create the sprites in exists.
        output_file = os.path.join(target_folder, self.to_rel)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        # Create the scaled sprites.
        sprite_annotations = {}
        for size_class in self.get_size_classes():
            # Generate the sprite's annotations.
            to_rel = append_size_class(self.to_rel, size_class)
            annotations, total_width, max_height = self.generate_sprite_annotations(size_class)
            sprite_annotations[to_rel] = annotations

            # Determine whether we need to generate the sprite image itself.
            scaled_file = append_size_class(output_file, size_class)
            scaled_file_png = scaled_file + ".png"
            scaled_file_webp = scaled_file + ".webp"
            if mtime <= getmtime(scaled_file_png) and mtime <= getmtime(scaled_file_webp):
                continue

            # Generate the sprite image.
            sprite_image = self.generate_sprite_image(size_class, total_width, max_height)
            sprite_image.save(scaled_file_png)
            update_mtime(scaled_file_png, self.image_from_rels)
            print("{}created {}".format(prefix, scaled_file_png))
            sprite_image.save(scaled_file_webp)
            update_mtime(scaled_file_webp, self.image_from_rels)
            print("{}created {}".format(prefix, scaled_file_webp))

        return sprite_annotations

    def generate_sprite_annotations(self, size_class):
        annotations = {}
        total_width = 0
        max_height = 0
        for image in self.images:
            size = image.sizes[size_class]
            width = size.calc_width(*image.get_original().size)
            height = size.calc_height(*image.get_original().size)
            annotations[image.from_rel] = {
                "width": width,
                "height": height,
                "x_offset": total_width,
                "y_offset": 0
            }
            total_width += width
            max_height = max(max_height, height)

        return annotations, total_width, max_height

    def generate_sprite_image(self, size_class, total_width, max_height):
        sprite_image = PILImage.new('RGBA', (total_width, max_height))
        x_offset = 0
        for image in self.images:
            scaled_image = image.get_scaled(image.sizes[size_class])
            sprite_image.paste(scaled_image, (x_offset, 0))
            x_offset += scaled_image.size[0]
        return sprite_image


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
        update_mtime(file, self.source_files)


def clean(target_folder, comp_spec, *, prefix=""):
    """
    Completely empty the compilation folder.
    """
    shutil.rmtree("compiled")
    os.makedirs("compiled")


def create_sitemap(target_folder, comp_spec, *, prefix=""):
    """
    Reads the sitemap template, fills in the last modified time, and outputs it.
    """
    date_w3c = datetime.now().strftime("%Y-%m-%d")
    with open(comp_spec.sitemap_source) as source_file:
        output_sitemap = ""
        for line in source_file:
            output_sitemap += line.replace("<lastmod/>", "<lastmod>" + date_w3c + "</lastmod>")

    dest = os.path.join(target_folder, comp_spec.sitemap_dest)
    with open(dest, "w") as dest_file:
        dest_file.write(output_sitemap)


def copy_html(target_folder, comp_spec, *, prefix=""):
    """
    Copies all of the HTML files to the target folder.
    """
    for from_path, to_rel in comp_spec.html_files.items():
        to_path = os.path.join(target_folder, to_rel)
        os.makedirs(os.path.dirname(to_path), exist_ok=True)
        shutil.copyfile(from_path, to_path)
        update_mtime(to_path, [from_path])
        print("{}copied {}".format(prefix, to_rel))


def combine_js(target_folder, comp_spec, *, prefix=""):
    """
    Concatenate all javascript into a single source file.
    """
    for to_rel, file_list in comp_spec.js_files.items():
        output_file = os.path.join(target_folder, to_rel)
        assert execute_piped_commands(
            ["npx", "babel", "--presets=@babel/env"] + file_list,
            output_file,
            prefix=prefix
        )
        update_mtime(output_file, file_list)


def combine_minify_js(target_folder, comp_spec, *, prefix=""):
    """
    Concatenate all javascript into a single source file, and minify it.
    """
    for to_rel, file_list in comp_spec.js_files.items():
        output_file = os.path.join(target_folder, to_rel)
        assert execute_piped_commands(
            ["npx", "babel", "--presets=@babel/env"] + file_list,
            ["uglifyjs", "--compress", "--mangle"],
            output_file,
            prefix=prefix
        )
        update_mtime(output_file, file_list)


def minify_css(target_folder, comp_spec, *, prefix=""):
    """
    Minify the CSS of the website.
    """
    output_file = os.path.join(target_folder, comp_spec.css_dest)
    assert execute_piped_commands(
        ["npx", "uglifycss", comp_spec.css_source],
        output_file,
        prefix=prefix
    )
    update_mtime(output_file, [comp_spec.css_source])


def create_sprites(target_folder, comp_spec, annotations, *, prefix=""):
    """
    Concatenate groups of images into a single image.
    """
    for sprite in comp_spec.sprites.values():
        sprite_annotations = sprite.save_sprite_copies(target_folder, prefix=prefix)
        annotations.add("sprites", sprite_annotations, os.path.join(target_folder, sprite.to_rel))


def copy_resource_files(target_folder, comp_spec, *, prefix=""):
    """
    Copy all the resource files for the page into the target folder.
    """
    # Copy static files.
    for from_path, to_rel in comp_spec.res_files.items():
        to_path = os.path.join(target_folder, to_rel)
        if getmtime(from_path) <= getmtime(to_path):
            continue

        os.makedirs(os.path.dirname(to_path), exist_ok=True)
        shutil.copyfile(from_path, to_path)
        update_mtime(to_path, [from_path])
        print("{}copied {}".format(prefix, to_rel))

    # Copy and scale images.
    for from_rel, image in comp_spec.images.items():
        if image.to_rel is not None:
            image.save_image_copies(target_folder, prefix=prefix)

    # Create the favicon images.
    favicon_image = PILImage.open("res/favicon.png")
    favicon_path = os.path.join(target_folder, "favicon{}.ico")
    target_sizes = [16, 32, 64, 96, 128]
    for size in target_sizes:
        favicon_scaled = favicon_image.resize((size, size), PILImage.LANCZOS)
        favicon_scaled.save(favicon_path.format(size), sizes=[(size, size)])
        if size == max(target_sizes):
            favicon_scaled.save(favicon_path.format(""), sizes=[(size, size) for size in target_sizes])


def combine_annotations(target_folder, comp_spec, annotations, *, prefix=""):
    """
    Combine all resource annotations into their own file.
    """
    for key, file in comp_spec.annotation_files.items():
        annotations.read(key, file)
    annotations.write(os.path.join(target_folder, "res/annotations.json"))


def add_file_versions(target_folder, comp_spec, *, prefix="", skip_versions=False):
    """
    Filters through all HTML, CSS, and JS files and replaces [ver]
    patterns in file paths with their last modification time.
    """
    # The order here is important!!
    # The HTML files reference the CSS and JS files so they must be created first.
    files_to_filter = [
        comp_spec.css_dest,
        *comp_spec.js_files.keys(),
        *comp_spec.html_files.values()
    ]
    for file_rel in files_to_filter:
        # Read the original file.
        file_path = os.path.join(target_folder, file_rel)
        file_mtime = getmtime(file_path)
        with open(file_path, 'r') as file:
            original_content = file.read()

        # Filter out all [ver]'s in the file.
        last_index = 0
        filtered = ""
        while True:
            try:
                current_index = original_content.index(".[ver]", last_index)
            except ValueError:
                filtered += original_content[last_index:]
                break

            filtered += original_content[last_index:current_index]
            last_index = current_index + len(".[ver]")

            try:
                string_start = original_content.rindex("\"", 0, current_index)
                string_end = original_content.index("\"", last_index)
            except ValueError:
                raise Exception("Found [ver] outside of string in file {}".format(file_path))

            ver_target_file = original_content[string_start + 1:string_end].replace(".[ver]", "")
            if ver_target_file.startswith("https://royalur.net/"):
                ver_target_file = ver_target_file[len("https://royalur.net/"):]

            file = os.path.join(target_folder, file_rel)
            version_mtime = get_incomplete_file_mtime(os.path.join(target_folder, ver_target_file))
            file_mtime = max(file_mtime, version_mtime)

            # We still find the version even if skip_versions is True,
            # just to make sure that everything works.
            if not skip_versions:
                filtered += ".v{}".format(int(version_mtime))

        # Write out the filtered file.
        with open(file_path, 'w') as file:
            file.write(filtered)
        set_mtime(file_path, file_mtime)


def zip_development_res_folder(target_folder, comp_spec, *, prefix=""):
    """
    Creates a zip file with the full contents of the development resources folder.
    """
    output_file = os.path.join(target_folder, "res.zip")
    # For some reason the zip command never exits if shell=True is used in subprocess.Popen...
    assert execute_command("zip", "-q", "-r", output_file, "./res", prefix=prefix, use_shell=False)


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

    print("\n1. Clean")
    clean(target_folder, comp_spec, prefix=" .. ")

    print("\n2. Create a Sitemap")
    create_sitemap(target_folder, comp_spec, prefix=" .. ")

    print("\n3. Copy HTML")
    copy_html(target_folder, comp_spec, prefix=" .. ")

    print("\n4. Combine & Minify Javascript")
    combine_minify_js(target_folder, comp_spec, prefix=" .. ")

    print("\n5. Minify CSS")
    minify_css(target_folder, comp_spec, prefix=" .. ")

    print("\n6. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=" .. ")

    print("\n7. Create Sprites")
    annotations = Annotations()
    create_sprites(target_folder, comp_spec, annotations, prefix=" .. ")

    print("\n8. Create Annotations File")
    combine_annotations(target_folder, comp_spec, annotations, prefix=" .. ")

    print("\n9. Add Dynamic File Versions")
    add_file_versions(target_folder, comp_spec, prefix=" .. ")

    print("\n10. Zip Development Resources Folder")
    zip_development_res_folder(target_folder, comp_spec, prefix=" .. ")

    print("\nDone!\n")


def create_dev_build(target_folder):
    print("\nCompiling Development Build")
    comp_spec = CompilationSpec.read("compilation.json")

    print("\n1. Create a Sitemap")
    create_sitemap(target_folder, comp_spec, prefix=" .. ")

    print("\n2. Copy HTML")
    copy_html(target_folder, comp_spec, prefix=" .. ")

    print("\n3. Combine Javascript")
    combine_js(target_folder, comp_spec, prefix=" .. ")

    print("\n4. Minify CSS")
    minify_css(target_folder, comp_spec, prefix=" .. ")

    print("\n5. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=" .. ")

    print("\n6. Create Sprites")
    annotations = Annotations()
    create_sprites(target_folder, comp_spec, annotations, prefix=" .. ")

    print("\n7. Create Annotations File")
    combine_annotations(target_folder, comp_spec, annotations, prefix=" .. ")

    print("\n8. Remove File Version Tags from Filenames")
    add_file_versions(target_folder, comp_spec, prefix=" .. ", skip_versions=True)

    print("\nDone!\n")


def create_nojs_build(target_folder):
    print("\nCompiling Development NoJS Build")
    comp_spec = CompilationSpec.read("compilation.json")

    print("\n1. Create a Sitemap")
    create_sitemap(target_folder, comp_spec, prefix=" .. ")

    print("\n2. Copy HTML")
    copy_html(target_folder, comp_spec, prefix=" .. ")

    print("\n3. Minify CSS")
    minify_css(target_folder, comp_spec, prefix=" .. ")

    print("\n4. Copy Resource Files")
    copy_resource_files(target_folder, comp_spec, prefix=" .. ")

    print("\n5. Create Sprites")
    annotations = Annotations()
    create_sprites(target_folder, comp_spec, annotations, prefix=" .. ")

    print("\n6. Create Annotations File")
    combine_annotations(target_folder, comp_spec, annotations, prefix=" .. ")

    print("\n7. Remove File Version Tags from Filenames")
    add_file_versions(target_folder, comp_spec, prefix=" .. ", skip_versions=True)

    print("\nDone!\n")


#
# Run the Compilation
#
if __name__ == "__main__":
    # Download the resources folder if it doesn't exist.
    if not os.path.exists("./res"):
        print("\nCould not find ./res directory, attempting to download it...")
        download_development_res_folder(prefix=" .. ")

    # Create the compiled folder if it doesn't exist.
    if not os.path.exists("./compiled"):
        print("\nCould not find ./compiled directory, creating it...")
        os.mkdir("./compiled")

    # Create the compiled folder if it doesn't exist.
    if not os.path.exists("./node_modules"):
        print("\nDetected missing NPM dependencies as ./node_modules is missing, installing them...")
        install_dependencies(prefix=" .. ")


    # Detect the compilation mode, and start it.
    mode = (sys.argv[1] if len(sys.argv) == 2 else "")
    if mode == "release":
        create_release_build("compiled")
    elif mode == "dev":
        create_dev_build("compiled")
    elif mode == "nojs":
        create_nojs_build("compiled")
    else:
        if mode != "":
            print("Invalid compilation mode", mode)

        print("Usage:")
        print("  python -m compile <dev:release:nojs>")
        sys.exit(1)
