const spawn = require('child_process').spawn;
const DockerCliError = require('./dockerCliError');
const slugify = require('slugify');
const goby = require('goby').init();

function runDockerCli(params, formatted) {
    if (formatted) params = params.concat(['--format'], ['\'{{json .}}\'']);

    return new Promise((resolve, reject) => {
        try {
            const docker = spawn('docker', params);
            let stdout, stderr = null;

            docker.stdout.on('data', (data) => {
                if (!stdout) stdout = '';
                stdout += data;
            });

            docker.stderr.on('data', (data) => {
                if (!stderr) stderr = '';
                stderr += data;
            });

            docker.on('exit', (code) => {
                if (formatted) {
                    if (stdout == null) stdout = '';
                    stdout = stdout
                        .split('\n')
                        .filter(line => line)
                        .map(line => line.substring(1, line.length - 1))
                        .map(line => JSON.parse(line));
                }

                if (code == 0) resolve(stdout);
                else reject(new DockerCliError(code, stderr));
            });
        } catch (ex) {
            reject(ex);
        }
    });
}

class DockerCli {
    async listStacks() {
        return await runDockerCli(['stack', 'ls'], true);
    }

    async ping() {
        try {
            await runDockerCli(['version']);
            return true;
        } catch (ex) {
            return false;
        }
    }

    async deployStack(composeFile, name = null) {
        if (composeFile == null) throw new TypeError('The composeFile argument must be a string');        
        if (name != null && typeof(name) != 'string') throw new TypeError('The name argument must be a string or null');

        if (name == null) name = goby.generate(['adj', 'suf']);
        let slugifiedName = slugify(name.toLowerCase());

        await runDockerCli(['stack', 'deploy', '--compose-file', composeFile, slugifiedName]);
        return slugifiedName;
    }

    async removeStack(name) {
        if (typeof(name) != 'string') throw new TypeError('The name argument must be a string');

        let slugifiedName = slugify(name);
        await runDockerCli(['stack', 'rm', slugifiedName]);
        return true;
    }

    async pruneSystem() {
        return await runDockerCli(['system', 'prune', '-f']);
    }
}

module.exports = DockerCli;