import * as http from 'http';
import httpProxy from 'http-proxy';
import axios from 'axios';
import {config} from "../config";
import logger from "../utils/logger";

const urls = config.targets

async function findAvailableUrl(): Promise<string | null> {
    for (const url of urls) {
        try {
            await axios.get(`http://${url}`, { timeout: config.timeout });
            logger.info(`URL trouvée : ${url}`);
            return url;
        } catch (error) {
            logger.error(`URL indisponible : ${url}`);
        }
    }
    return null;
}


export function startProxyServer() {
    const proxy = httpProxy.createProxyServer({});
    const server = http.createServer(async (req, res) => {
        try {
            const targetUrl = await findAvailableUrl();

            if (targetUrl) {
                logger.info(`Proxy vers ${targetUrl}`);
                proxy.web(req, res, { target: `http://${targetUrl}` });
            } else {
                res.writeHead(503, { 'Content-Type': 'text/plain' });
                res.end('Aucune URL disponible');
            }
        } catch (err) {
            if (err instanceof Error) {
                logger.error('Erreur lors du traitement de la requête :', err.message);
            } else {
                logger.error('Erreur lors du traitement de la requête :', err);
            }
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Erreur interne du serveur');
        }
    });

    proxy.on('error', (err, req, res) => {
        logger.error('Erreur du proxy :', err.message);
        if (res instanceof http.ServerResponse) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Erreur lors de la redirection proxy');
        }
    });

    server.listen(config.port, config.host, () => {
        logger.info(`Proxy démarré sur le port ${config.port}`);
    });
}
