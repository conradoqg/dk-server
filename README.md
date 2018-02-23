dk-server

```sh
docker service create --name dk-server --publish 80:80 --constraint 'node.role == manager' --mount type=bind,src=//var/run/docker.sock,dst=/var/run/docker.sock dk-server
```