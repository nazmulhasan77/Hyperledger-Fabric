# 🚀 **Hyperledger Fabric Asset Transfer Project Documentation**

This project demonstrates setting up a **Hyperledger Fabric test network** and running a simple **Asset Transfer API Server** using **Node.js** and **Go chaincode**.

---

## 📂 **Project Structure**

```
HLF-Project-Asset-Transfer/
├── fabric-samples/       # Hyperledger Fabric sample network
│   └── test-network/     # Test network scripts
├── api-server/           # Express.js server for Asset Transfer
└── chaincode/            # Chaincode written in Go
```

---

## ⚙️ **Prerequisites**

Make sure the following are installed:

* Git
* cURL / wget
* Docker & Docker Compose
* WSL2 (Ubuntu 22.04 recommended, if on Windows)
* Node.js **>= 20.x** & npm
* Go (for chaincode development)

---

## 🛠️ **Setup Instructions**

### **1️⃣ Clone Fabric Samples and Install Binaries**

```bash
# location: HLF-Project-Asset-Transfer/
git clone https://github.com/hyperledger/fabric-samples.git
cd fabric-samples

# install Fabric binaries
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s

# add binaries to PATH
export PATH=$PATH:$PWD/bin

# verify installation
peer version
```

---

### **2️⃣ Start the Test Network**

```bash
cd test-network

# bring up the network and create a channel
./network.sh up createChannel -c mychannel -ca

# deploy the chaincode
./network.sh deployCC -ccn asset -ccp ../../chaincode -ccl go
```

✅ This creates a channel `mychannel` and deploys the `asset` chaincode.

---

### **3️⃣ Verify Chaincode Commit**

```bash
peer lifecycle chaincode querycommitted --channelID mychannel --name asset
```

Expected output:

```
Committed chaincode definition for chaincode 'asset' on channel 'mychannel':
Version: 1.0, Sequence: 1, Endorsement Plugin: escc, Validation Plugin: vscc,
Approvals: [Org1MSP: true, Org2MSP: true]
```

---

### **4️⃣ Run the API Server**

```bash
cd ../../api-server

# clean existing installs if needed
rm -rf node_modules package-lock.json

# install dependencies
npm install express @hyperledger/fabric-gateway @grpc/grpc-js

# start the server
node server.js
```

Expected output:

```
Connecting to Fabric network...
Successfully connected to the smart contract.
Server is running on http://localhost:3000
```

---

### **5️⃣ Test the API**

* **Get all assets**

```bash
curl http://localhost:3000/api/assets
```

* **Create asset**

```bash
curl -X POST http://localhost:3000/api/assets \
-H "Content-Type: application/json" \
-d '{"ID":"asset1","Color":"blue","Owner":"Alice","Size":10,"AppraisedValue":100}'
```

---

### **6️⃣ Shut Down the Network**

```bash
cd ../fabric-samples/test-network
./network.sh down
```

---

## ⚡ **Common Problems & Solutions**

| Problem                                                     | Solution                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm install` fails with UNC/EISDIR/ENOTEMPTY errors in WSL | Remove `node_modules` and `package-lock.json`, then reinstall packages |
| Node.js version issues causing npm failures                 | Install **Node.js 20.x** from Nodesource instead of WSL default        |
| `querycommitted` returns 404                                | Ensure chaincode is approved by all orgs and committed successfully    |
| npm vulnerabilities (`jsrsasign`)                           | Run `npm audit fix`; use `--force` only if compatible                  |

---

## ✅ **Summary**

* Fabric binaries & Docker containers set up using `install-fabric.sh`.
* Test network launched with a single channel (`mychannel`).
* Asset Transfer chaincode deployed successfully.
* Node.js API server connected to Fabric Gateway and serving requests.

