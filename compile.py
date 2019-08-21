#
# Compile the RoyalUr website into a smaller, coherent unit.
#

import os
import sys
import json
import subprocess



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
    if isinstance(commands[-1], basestring):
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

        print prefix + command_print
        if last_process is None:
            last_process = subprocess.Popen(command, stdout=pipe_out)
        else:
            last_process = subprocess.Popen(command, stdin=last_process.stdout, stdout=pipe_out)

    try:
        stdout, stderr = last_process.communicate()
        retCode = last_process.returncode

        if stdout is not None and stdout != "":
            print prefix + "STDOUT:", stdout
        if stderr is not None and stderr != "":
            print >>sys.stderr, prefix + "STDERR", stderr

        if retCode < 0:
            print >>sys.stderr, prefix + "Execution of", str(command), " was terminated by signal:", -retCode
        elif retCode != 0:
            print >>sys.stderr, prefix + "Command", str(command), " resulted in the non-zero return code:", retCode

        return retCode == 0
    except OSError as error:
        print >>sys.stderr, prefix + "Execution of", str(command), "failed:", error
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
        annotation_files = compilation_specs["annotations"]
        return javascript_files, resource_files, annotation_files


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


def copyResourceFiles(target_folder, resource_files, prefix=""):
    """
    Copy all the resource files for the page into the target folder.
    """
    assert executePipedCommands(["rsync", "-R"] + resource_files + [target_folder], prefix=prefix)


def combineAnnotations(target_folder, annotation_files, prefix=""):
    """
    Combine all resource annotations into their own file.
    """
    annotations = {}
    for key, file in annotation_files.items():
        with open(file, "r") as f:
            annotations[key] = json.load(f)

    with open(target_folder + "/res/annotations.json", 'w') as f:
        json.dump(annotations, f, separators=(',', ':'))


def createReleaseBuild(target_folder):
    print "\nCompiling Release Build"
    javascript_files, resource_files, annotation_files = loadCompilationSpec()

    print "\n1. Clean"
    clean(target_folder, prefix=" .. ")

    print "\n2. Combine & Minify Javascript"
    combineMinifyJS(target_folder, javascript_files, prefix=" .. ")

    print "\n3. Copy Resource Files"
    copyResourceFiles(target_folder, resource_files, prefix=" .. ")

    print "\n4. Create Annotations File"
    combineAnnotations(target_folder, annotation_files, prefix=" .. ")

    print "\nDone!\n"


def createDevBuild(target_folder):
    print "\nCompiling Development Build"
    javascript_files, resource_files, annotation_files = loadCompilationSpec()

    print "\n1. Check whether to revert to a Release Build"
    if requiresReleaseBuild(target_folder, resource_files):
        print >>sys.stderr, " .. ERROR : Release build is required\n"
        createReleaseBuild(target_folder)
        return

    print "\n2. Combine Javascript"
    combineJS(target_folder, javascript_files, prefix=" .. ")

    print "\nDone!\n"


#
# Run the Compilation
#
DEV_MODE = "dev"
RELEASE_MODE = "release"

if len(sys.argv) != 2:
    print "Usage:"
    print "  python -m compile <" + DEV_MODE + ":" + RELEASE_MODE + ">"
    sys.exit(1)

compilation_mode = (sys.argv[1] if len(sys.argv) == 2 else "")

if compilation_mode == RELEASE_MODE:
    createReleaseBuild("compiled")
elif compilation_mode == DEV_MODE:
    createDevBuild("compiled")
else:
    if compilation_mode != "":
        print "Invalid compilation mode", compilation_mode

    print "Usage:"
    print "  python -m compile <" + DEV_MODE + ":" + RELEASE_MODE + ">"
    sys.exit(1)
