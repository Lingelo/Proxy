import {config} from "../config";
import http, {IncomingMessage, ServerResponse} from "http";
import httpProxy, {type ServerOptions} from "http-proxy";
import axios from "axios";

export interface Proxy {
    start(): Promise<void>;
}


export function createProxy(): Proxy {

    const proxy = httpProxy.createProxyServer({} as ServerOptions);

    async function start(): Promise<void> {
        try {
            const firstIndex = await testURLs();
            if (!firstIndex) {
                throw new Error("Aucunes urls disponibles")
            }

            const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
                proxy.web(req, res, {
                    target: `http://${config.targets[firstIndex]}`,
                    selfHandleResponse: false,
                });

                server.on("error", (err: Error, req_: IncomingMessage | undefined, res_: ServerResponse | undefined) => {
                    throw new Error("Erreur serveur : " + err);
                });
            });

            server.listen(config.port, config.host, () => {
                console.log(`Proxy démarré sur http://${config.host}:${config.port}`);
            });
        } catch (error) {
            console.error("Échec du démarrage du serveur proxy : ", error);
        }
    }

    return {
        start
    }

}

async function testURLs(): Promise<number | undefined> {

    if (config.targets.length === 0) {
        throw new Error("TARGET_URLS non définie ou ne contient aucune URL");
    }

    let firstIndex
    for (const [index, target] of config.targets.entries()) {
        try {
            await axios.head(`http://${target}`, { timeout: config.timeout });
            firstIndex = index
        } catch (error) {}
    }
    return firstIndex
}
