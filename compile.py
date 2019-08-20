#
# Compile the RoyalUr website into a smaller, coherent unit.
#

import os
import sys
import json
import subprocess


def executeCommand(*command):
    """
    Shorthand to execute a single command.
    """
    return executePipedCommands(command)


def executePipedCommands(*commands):
    """
    Executes the given commands where the output of each is piped to the next.
    The last command can be a string filename, in which case the final output will be written to the file.
    Returns whether execution was successful.
    """
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

        print command_print
        if last_process is None:
            last_process = subprocess.Popen(command, stdout=pipe_out)
        else:
            last_process = subprocess.Popen(command, stdin=last_process.stdout, stdout=pipe_out)

    try:
        stdout, stderr = last_process.communicate()
        retCode = last_process.returncode

        if stdout is not None and stdout != "":
            print "STDOUT:", stdout
        if stderr is not None and stderr != "":
            print >>sys.stderr, "STDERR", stderr

        if retCode < 0:
            print >>sys.stderr, "Execution of", str(command), " was terminated by signal:", -retCode
        elif retCode != 0:
            print >>sys.stderr, "Command", str(command), " resulted in the non-zero return code:", retCode

        return retCode == 0
    except OSError as error:
        print >>sys.stderr, "Execution of", str(command), "failed:", error
        return False


# Load the compilation spec
with open("compilation.json", 'r') as f:
    compilation_specs = json.load(f)
    javascript_files = compilation_specs["javascript"]
    resource_files = compilation_specs["resources"]
    annotation_files = compilation_specs["annotations"]


# Delete the old compiled folder, and recreate it
assert executeCommand("rm", "-rf", "compiled")
assert executeCommand("mkdir", "compiled")

# Concatenate all javascript files into one file
assert executePipedCommands(["uglifyjs"] + javascript_files + ["--compress", "--mangle"], "compiled/index.js")

# Copy all resource files
for resource in resource_files:
    assert executeCommand("rsync", "-R", resource, "compiled")

# Concatenate all annotations into a single annotations file
annotations = {}
for key, file in annotation_files.items():
    with open(file, "r") as f:
        annotations[key] = json.load(f)

with open("compiled/res/annotations.json", 'w') as f:
    json.dump(annotations, f, separators=(',', ':'))
