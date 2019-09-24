#
# Compile the RoyalUr website into a smaller, coherent unit.
#

import os
import sys
import json
import subprocess
from PIL import Image



#
# Utility Functions
#

def executeCommand(*command, **kwargs):
    """
    Shorthand to execute a single command.
    """
    return executePipedCommands(command, **kwargs)


def executePipedCommands(*commands, **kwargs):
    """
    Executes the given commands where the output of each is piped to the next.
    The last command can be a string filename, in which case the final output will be written to the file.
    Returns whether execution was successful.
    """
    prefix = kwargs.pop("prefix", "")

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
        if last_process is None:
            last_process = subprocess.Popen(command, stdout=pipe_out)
        else:
            last_process = subprocess.Popen(command, stdin=last_process.stdout, stdout=pipe_out)

    try:
        stdout, stderr = last_process.communicate()
        stdout = ("" if stdout is None else stdout.decode('utf-8'))
        stderr = ("" if stderr is None else stderr.decode('utf-8'))
        retCode = last_process.returncode

        if stdout != "":
            print(prefix + "STDOUT:", stdout)
        if stderr != "":
            print(prefix + "STDERR", stderr, file=sys.stderr)

        if retCode < 0:
            print(prefix + "Execution of", command[0], "was terminated by signal:", -retCode, file=sys.stderr)
        elif retCode != 0:
            print(prefix + "Command", command[0], "resulted in the non-zero return code:", retCode, file=sys.stderr)

        return retCode == 0
    except OSError as error:
        print(prefix + "Execution of", command[0], "failed:", error, file=sys.stderr)
        return False



#
# Perform Compilation
#

def loadCompilationSpec(spec_file="compilation.json"):
    """
    Load the specification for this compilation.
    """
    with open(spec_file, 'r') as f:
        compilation_specs = json.load(f)
        javascript_files = compilation_specs["javascript"]
        resource_files = compilation_specs["resources"]
        sprite_groups = compilation_specs["sprites"]
        annotation_files = compilation_specs["annotations"]
        return javascript_files, resource_files, sprite_groups, annotation_files


def requiresReleaseBuild(target_folder, resource_files, prefix=""):
    """
    Check whether all resource files exist in the compiled directory.
    Does not check if any annotations or resource file contents have changed.
    """
    for file in [""] + resource_files:
        if not os.path.exists(target_folder + "/" + file):
            return True
    if not os.path.exists(target_folder + "/res/annotations.json"):
        return True
    return False


def clean(target_folder, prefix=""):
    """
    Completely empty the compilation folder.
    """
    assert executeCommand("rm", "-rf", target_folder, prefix=prefix)
    assert executeCommand("mkdir", target_folder, prefix=prefix)


def combineJS(target_folder, javascript_files, prefix=""):
    """
    Concatenate all javascript into a single source file.
    """
    assert executePipedCommands(["cat"] + javascript_files, target_folder + "/index.js", prefix=prefix)


def combineMinifyJS(target_folder, javascript_files, prefix=""):
    """
    Concatenate all javascript into a single source file, and minify it.
    """
    assert executePipedCommands(
        ["uglifyjs"] + javascript_files + ["--compress", "--mangle"], target_folder + "/index.js",
        prefix=prefix
    )


def createSprites(target_folder, sprite_groups, prefix=""):
    """
    Concatenate groups of images into a single image.
    """
    sprite_annotations = {}

    for target_file, group in sprite_groups.items():
        annotations = {}
        images = []

        total_width = 0
        max_height = 0

        for file in group:
            image = Image.open(file)
            images.append(image)

            annotations[file] = {
                "width": image.size[0],
                "height": image.size[1],
                "x_offset": total_width,
                "y_offset": 0
            }

            total_width += image.size[0]
            max_height = max(image.size[1], max_height)

        sprite = Image.new('RGBA', (total_width, max_height))

        x_offset = 0
        for image in images:
            sprite.paste(image, (x_offset, 0))
            x_offset += image.size[0]

        output_file = os.path.join(target_folder, target_file)
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        sprite.save(output_file)

        sprite_annotations[target_file] = annotations

    return sprite_annotations


def copyResourceFiles(target_folder, resource_files, prefix=""):
    """
    Copy all the resource files for the page into the target folder.
    """
    assert executePipedCommands(["rsync", "-R"] + resource_files + [target_folder], prefix=prefix)


def combineAnnotations(target_folder, annotation_files, additional_annotations, prefix=""):
    """
    Combine all resource annotations into their own file.
    """
    annotations = {**additional_annotations}
    for key, file in annotation_files.items():
        with open(file, "r") as f:
            annotations[key] = json.load(f)

    with open(target_folder + "/res/annotations.json", 'w') as f:
        json.dump(annotations, f, separators=(',', ':'))


def createReleaseBuild(target_folder):
    print("\nCompiling Release Build")
    javascript_files, resource_files, sprite_groups, annotation_files = loadCompilationSpec()

    print("\n1. Clean")
    clean(target_folder, prefix=" .. ")

    print("\n2. Combine & Minify Javascript")
    combineMinifyJS(target_folder, javascript_files, prefix=" .. ")

    print("\n3. Copy Resource Files")
    copyResourceFiles(target_folder, resource_files, prefix=" .. ")

    print("\n4. Create Sprites")
    sprite_annotations = createSprites(target_folder, sprite_groups, prefix=" .. ")

    print("\n5. Create Annotations File")
    combineAnnotations(target_folder, annotation_files, {
        "sprites": sprite_annotations
    }, prefix=" .. ")

    print("\nDone!\n")


def createDevBuild(target_folder):
    print("\nCompiling Development Build")
    javascript_files, resource_files, sprite_groups, annotation_files = loadCompilationSpec()

    print("\n1. Combine Javascript")
    combineJS(target_folder, javascript_files, prefix=" .. ")

    print("\n2. Copy Resource Files")
    copyResourceFiles(target_folder, resource_files, prefix=" .. ")

    print("\n3. Create Sprites")
    sprite_annotations = createSprites(target_folder, sprite_groups, prefix=" .. ")

    print("\n4. Create Annotations File")
    combineAnnotations(target_folder, annotation_files, {
        "sprites": sprite_annotations
    }, prefix=" .. ")

    print("\nDone!\n")


def createJSDevBuild(target_folder):
    print("\nCompiling Javascript Development Build")
    javascript_files, resource_files, sprite_groups, annotation_files = loadCompilationSpec()

    print("\n1. Check whether to revert to a Release Build")
    if requiresReleaseBuild(target_folder, resource_files):
        print >>sys.stderr, " .. ERROR : Release build is required\n"
        createReleaseBuild(target_folder)
        return

    print("\n2. Combine Javascript")
    combineJS(target_folder, javascript_files, prefix=" .. ")

    print("\nDone!\n")


#
# Run the Compilation
#
DEV_MODE = "dev"
JS_DEV_MODE = "jsdev"
RELEASE_MODE = "release"

if len(sys.argv) != 2:
    print("Usage:")
    print("  python -m compile <" + DEV_MODE + ":" + JS_DEV_MODE + ":" + RELEASE_MODE + ">")
    sys.exit(1)

compilation_mode = (sys.argv[1] if len(sys.argv) == 2 else "")

if compilation_mode == RELEASE_MODE:
    createReleaseBuild("compiled")
elif compilation_mode == JS_DEV_MODE:
    createJSDevBuild("compiled")
elif compilation_mode == DEV_MODE:
    createDevBuild("compiled")
else:
    if compilation_mode != "":
        print("Invalid compilation mode", compilation_mode)

    print("Usage:")
    print("  python -m compile <" + DEV_MODE + ":" + RELEASE_MODE + ">")
    sys.exit(1)
