# **Hyperledger Fabric Asset Transfer Project Documentation**

## **1. Project Overview**

This project demonstrates a basic asset transfer application on Hyperledger Fabric using **Go chaincode**, **Fabric Gateway Node.js API server**, and **Express.js**.

**Components:**

* Fabric test network (`test-network`)
* Chaincode in Go (`chaincode/`)
* API server (`api-server/`) using Node.js
* Frontend (optional) to interact with API server

---

## **2. Setting Up the Environment**

### **Step 1: Install WSL and Ubuntu**

* Use **Windows Subsystem for Linux (WSL 2)** with **Ubuntu 22.04**.

**Commands:**

```bash
wsl --install
wsl --set-version Ubuntu-22.04 2
```

---

### **Step 2: Install Docker**

* Required for running Hyperledger Fabric network.
* Ensure Docker Desktop is running with WSL integration.

**Commands:**

```bash
sudo apt update
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker $USER
```

---

### **Step 3: Install Go**

* Needed to compile chaincode written in Go.

**Commands:**

```bash
sudo apt install golang -y
go version
```

---

### **Step 4: Install Node.js and npm**

* Needed to run the API server and install required npm packages.

**Problems Faced:**

* Installing Node.js in WSL previously caused **UNC path issues** with npm.

**Solution:**

* Install **Node.js 20.x** directly using Nodesource repository instead of WSL default.

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

---

## **3. Setting Up Hyperledger Fabric Network**

### **Step 1: Navigate to test-network**

```bash
cd ~/HLF-Project-Asset-Transfer/fabric-samples/test-network
```

### **Step 2: Deploy the network**

```bash
./network.sh up createChannel -c mychannel -ca
```

**Notes:**

* This creates a channel named `mychannel` and starts CA for Org1 & Org2.

---

### **Step 3: Deploy chaincode**

```bash
./network.sh deployCC -ccn asset -ccp ../../chaincode -ccl go
```

**Problem Faced:**

* During deploy, Go dependencies were automatically downloaded.
* No major issues here; deployment succeeded.

---

### **Step 4: Verify chaincode commit**

```bash
peer lifecycle chaincode querycommitted --channelID mychannel --name asset
```

Output should show:

```
Committed chaincode definition for chaincode 'asset' on channel 'mychannel':
Version: 1.0, Sequence: 1, Endorsement Plugin: escc, Validation Plugin: vscc, Approvals: [Org1MSP: true, Org2MSP: true]
```

---

## **4. Setting Up Node.js API Server**

### **Step 1: Navigate to API server**

```bash
cd ~/HLF-Project-Asset-Transfer/api-server
```

---

### **Step 2: Clean existing node\_modules**

**Problem Faced:**

* `npm install` failed multiple times due to **EISDIR, ENOTEMPTY, and EPERM errors** in WSL node\_modules folder.

**Solution:**

```bash
rm -rf node_modules package-lock.json
npm install express @hyperledger/fabric-gateway @grpc/grpc-js
```

---

### **Step 3: Fix npm vulnerabilities**

**Problem Faced:**

* `npm audit` reported vulnerabilities in `jsrsasign` (used by Fabric SDK).

**Solution:**

* For now, fix automatically:

```bash
npm audit fix
```

> Note: Some vulnerabilities may require `--force` but that could cause breaking changes in Fabric SDK.

---

### **Step 4: Start the API server**

```bash
node server.js
```

**Expected Output:**

```
Connecting to Fabric network...
Successfully connected to the smart contract.
Server is running on http://localhost:3000
```

---

## **5. Common Issues and Solutions**

| Problem                                                     | Solution                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm install` fails with UNC/EISDIR/ENOTEMPTY errors in WSL | Remove `node_modules` and `package-lock.json`, then reinstall packages          |
| Node.js version issues causing npm failures                 | Install Node.js 20.x from Nodesource instead of WSL default                     |
| `querycommitted` returns 404                                | Ensure chaincode is approved by all organizations and committed successfully    |
| npm vulnerabilities (`jsrsasign`)                           | Run `npm audit fix`; for breaking changes, consider using specific SDK versions |

---

## **6. Testing the API Server**

* Open Postman or curl to test endpoints.
* Example: GET all assets:

```bash
curl http://localhost:3000/api/assets
```

* Example: Create asset:

```bash
curl -X POST http://localhost:3000/api/assets -H "Content-Type: application/json" -d '{"ID":"asset1","Color":"blue","Owner":"Alice","Size":10,"AppraisedValue":100}'
```

---

## **7. Summary**

* Hyperledger Fabric test network is **up and running**.
* Chaincode `asset` is **deployed, approved, and committed** on `mychannel`.
* Node.js **API server is connected** to the Fabric network.
* Project environment is fully functional.

---

