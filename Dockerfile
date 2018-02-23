FROM node:carbon

WORKDIR /dk-server

VOLUME /dk-server/data

COPY . /dk-server

RUN npm install forever -g
RUN npm install

ENV HOST 0.0.0.0
ENV PATH="/dk-server/third:${PATH}"

EXPOSE 80
EXPOSE 9229

ENTRYPOINT forever -c "node --inspect=0.0.0.0:9229" bin/dk-server.js 