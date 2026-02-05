FROM node:18-slim

# Mantemos a instalação do Chrome para quando formos ligar o bot no futuro
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
# Instala tudo que precisa
RUN npm install @wppconnect-team/wppconnect axios cors body-parser mysql2 express

COPY . .

EXPOSE 3000

# IMPORTANTE: Aponta para a pasta SRC
CMD [ "node", "src/index.js" ]