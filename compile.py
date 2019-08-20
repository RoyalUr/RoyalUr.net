#
# Compile the RoyalUr website into a smaller, coherent unit.
#

import os
import sys
import json
import subprocess


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


# Load the compilation spec
with open("compilation.json", 'r') as f:
    compilation_specs = json.load(f)
    javascript_files = compilation_specs["javascript"]
    resource_files = compilation_specs["resources"]
    annotation_files = compilation_specs["annotations"]


cmd_prefix = " .. "

# Delete the old compiled folder, and recreate it
print "\n1. Clean"
assert executeCommand("rm", "-rf", "compiled", prefix=cmd_prefix)
assert executeCommand("mkdir", "compiled", prefix=cmd_prefix)

# Concatenate all javascript files into one file
print "\n2. Combine & Minify Javascript"
assert executePipedCommands(
    ["uglifyjs"] + javascript_files + ["--compress", "--mangle"], "compiled/index.js",
    prefix=cmd_prefix
)

# Copy all resource files
print "\n3. Copy Resource Files"
assert executePipedCommands(["rsync", "-R"] + resource_files + ["compiled"], prefix=cmd_prefix)

# Combine all annotations into a single annotations file
print "\n4. Create Annotations File"
annotations = {}
for key, file in annotation_files.items():
    with open(file, "r") as f:
        annotations[key] = json.load(f)

with open("compiled/res/annotations.json", 'w') as f:
    json.dump(annotations, f, separators=(',', ':'))

# Done!
print "Done!"
