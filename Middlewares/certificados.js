const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const CERT_DIR = path.join(__dirname, '..', 'certs');
const KEY_PATH = path.join(CERT_DIR, 'server.key');
const CERT_PATH = path.join(CERT_DIR, 'server.crt');

const asegurarCertificado = async () => {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH),
      generado: false
    };
  }

  const cn = process.env.HTTPS_CN || 'localhost';
  const esIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cn);

  const atributos = [
    { name: 'commonName', value: cn },
    { name: 'organizationName', value: 'BimestManager' },
    { name: 'countryName', value: 'MX' }
  ];

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' }
  ];
  if (esIPv4) {
    altNames.push({ type: 7, ip: cn });
  } else {
    altNames.push({ type: 2, value: cn });
  }

  const ipsExtra = (process.env.HTTPS_SAN_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter((ip) => /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip));
  for (const ip of ipsExtra) {
    altNames.push({ type: 7, ip });
  }

  const par = await selfsigned.generate(atributos, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames
      }
    ]
  });

  fs.writeFileSync(KEY_PATH, par.private, { mode: 0o600 });
  fs.writeFileSync(CERT_PATH, par.cert);

  return { key: par.private, cert: par.cert, generado: true };
};

module.exports = { asegurarCertificado, KEY_PATH, CERT_PATH };
