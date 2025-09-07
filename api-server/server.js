'use strict';

const express = require('express');
const path = require('path');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs').promises;
const { TextDecoder } = require('util');
const grpc = require('@grpc/grpc-js');

const app = express();
const port = 3000;
const decoder = new TextDecoder();

// --- Configuration ---
const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'asset';
const mspId = process.env.MSP_ID || 'Org1MSP';

// Path to crypto materials. This path is resolved relative to the server.js file location.
const cryptoPath = process.env.CRYPTO_PATH || path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com');

// Path to user private key and certificate.
const keyDirectoryPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
const certPath = path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts', 'User1@org1.example.com-cert.pem');

// Path to peer tls certificate.
const tlsCertPath = path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');

// Gateway peer endpoint.
const peerEndpoint = process.env.PEER_ENDPOINT || 'localhost:7051';
const peerHostAlias = process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';

let contract;
let gateway;

// --- Main Application Logic ---
async function main() {
    console.log('Connecting to Fabric network...');
    
    // Create a new gRPC client for connecting to the peer.
    const client = await newGrpcConnection();

    // Create a new gateway for connecting to our peer node.
    gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(channelName);
        contract = network.getContract(chaincodeName);
        console.log('Successfully connected to the smart contract.');
    } catch (error) {
        console.error('Failed to connect to the smart contract.', error);
        if (gateway) {
            gateway.close();
        }
        process.exit(1);
    }
}

// --- Helper Functions for Connection ---
async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity() {
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner() {
    const files = await fs.readdir(keyDirectoryPath);
    const keyPath = path.resolve(keyDirectoryPath, files[0]);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

// --- API Routes ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Get all assets
app.get('/api/assets', async (req, res) => {
    try {
        console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');
        const resultBytes = await contract.evaluateTransaction('GetAllAssets');
        const resultJson = decoder.decode(resultBytes);
        const assets = resultJson ? JSON.parse(resultJson) : [];
        console.log(`*** Result: ${JSON.stringify(assets)}`);
        res.json(assets);
    } catch (error) {
        console.error('Failed to get assets:', error);
        res.status(500).json({ error: 'Failed to get assets' });
    }
});

// Search for an asset by ID
app.get('/api/assets/:id', async (req, res) => {
    try {
        const assetId = req.params.id;
        console.log(`\n--> Evaluate Transaction: SearchAssetByID, returns asset with ID ${assetId}`);
        const resultBytes = await contract.evaluateTransaction('SearchAssetByID', assetId);
        const resultJson = decoder.decode(resultBytes);
        const asset = resultJson ? JSON.parse(resultJson) : {};
        console.log(`*** Result: ${JSON.stringify(asset)}`);
        res.json(asset);
    } catch (error) {
        console.error(`Failed to get asset ${req.params.id}:`, error);
        res.status(500).json({ error: `Failed to get asset ${req.params.id}` });
    }
});


// Create a new asset
app.post('/api/assets', async (req, res) => {
    try {
        const { id, type, price, owner } = req.body;
        console.log(`\n--> Submit Transaction: CreateAsset, creates new asset with ID: ${id}`);
        await contract.submitTransaction(
            'CreateAsset',
            id,
            type,
            String(price),
            owner
        );
        console.log('*** Transaction committed successfully');
        res.status(201).json({ message: `Asset ${id} created successfully` });
    } catch (error) {
        console.error('Failed to create asset:', error);
        res.status(500).json({ error: `Failed to create asset: ${error.message}` });
    }
});

// Transfer an asset (Update Owner)
app.put('/api/assets/:id/transfer', async (req, res) => {
    try {
        const assetId = req.params.id;
        const { newOwner } = req.body;
        console.log(`\n--> Submit Transaction: TransferAsset, transfers asset ${assetId} to ${newOwner}`);
        await contract.submitTransaction(
            'TransferAsset',
            assetId,
            newOwner
        );
        console.log('*** Transaction committed successfully');
        res.json({ message: `Asset ${assetId} transferred to ${newOwner}` });
    } catch (error) {
        console.error('Failed to transfer asset:', error);
        res.status(500).json({ error: `Failed to transfer asset: ${error.message}` });
    }
});

// Update asset price
app.put('/api/assets/:id/price', async (req, res) => {
    try {
        const assetId = req.params.id;
        const { newPrice } = req.body;
        console.log(`\n--> Submit Transaction: UpdateAssetPrice, changes price of asset ${assetId} to ${newPrice}`);
        await contract.submitTransaction(
            'UpdateAssetPrice',
            assetId,
            String(newPrice)
        );
        console.log('*** Transaction committed successfully');
        res.json({ message: `Price of asset ${assetId} updated to ${newPrice}` });
    } catch (error) {
        console.error('Failed to update asset price:', error);
        res.status(500).json({ error: `Failed to update asset price: ${error.message}` });
    }
});

// Get asset history
app.get('/api/assets/:id/history', async (req, res) => {
    try {
        const assetId = req.params.id;
        console.log(`\n--> Evaluate Transaction: GetAssetHistory, returns the history of asset ${assetId}`);
        const resultBytes = await contract.evaluateTransaction('GetAssetHistory', assetId);
        const resultJson = decoder.decode(resultBytes);
        const history = resultJson ? JSON.parse(resultJson) : [];
        console.log(`*** Result: ${JSON.stringify(history)}`);
        res.json(history);
    } catch (error) {
        console.error('Failed to get asset history:', error);
        res.status(500).json({ error: 'Failed to get asset history' });
    }
});


// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
main().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}).catch(e => {
    console.error("Application failed to start: ", e);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Closing gateway connection...');
    if (gateway) {
        gateway.close();
    }
    process.exit(0);
});

