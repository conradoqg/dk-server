DK - A sandbox provisioning service
========

A middleman service that enables the provisioning of docker stacks to end users through an API.

[![Node.js version support][shield-node]](#)
[![Coverage][shield-coverage]](#)
[![MIT licensed][shield-license]](#)

Table of Contents
-----------------

  * [Requirements](#requirements)
  * [Getting Started](#getting-started)
  * [Usage](#usage)
  * [Contributing](#contributing)
  * [Support and Migration](#support-and-migration)
  * [License](#license)

Requirements
------------

DK requires the following to run:

  * [Node.js][node] 8.8.1+
  * [npm][npm] (normally comes with Node.js)
  * [Docker][docker] 17.12.0-ce+
  * Docker Swarm Mode activated

Getting Started
------------

The main goal of this service is to create a layer of abstraction that manages user authentication, docker stack templates and docker stack creation and deletion by the end user and adminstrators.

After running the service you can access the API documentation and play with it in http://localhost/api-docs.

Usage
------------
```sh
# Build docker image
$ npm run build

# Deploy as a container (linux and macosx only)
$ docker volume create dk_data
$ docker run -d -p 80:80 -v /var/run/docker.sock:/var/run/docker.sock -v dk_data:/dk-server/data dk-server

# Deploy as a service (linux, macosx and windows)
$ docker service create --name dk-server --publish 80:80 --constraint 'node.role == manager' --mount type=bind,src=//var/run/docker.sock,dst=/var/run/docker.sock dk-server
```

Contributing
------------

To contribute to DK, clone this repo locally and commit your code on a separate branch. Please write unit tests for your code before opening a pull-request:

```sh
# Clone the repository and run
$ npm install

# Running
$ npm start

# Testing
$ npm test

# Coverage
$ npm run coverage
```

Support and Migration
---------------------

DK server is in its alpha stage so expect breaking chances and no migration guide.

License
-------

DK is licensed under the [MIT](LICENSE) license.  
Copyright &copy; 2018, Conrado Quilles Gomes

[node]: https://nodejs.org/
[npm]: https://www.npmjs.com/
[docker]: https://www.docker.com/
[shield-coverage]: https://img.shields.io/badge/coverage-80%25-brightgreen.svg
[shield-license]: https://img.shields.io/badge/license-MIT-blue.svg
[shield-node]: https://img.shields.io/badge/node.js%20support-8.8.1-brightgreen.svg
