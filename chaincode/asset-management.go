package main

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/golang/protobuf/ptypes"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for managing an Asset
type SmartContract struct {
	contractapi.Contract
}

// Asset describes basic details of what makes up a simple asset
type Asset struct {
	ID    string `json:"ID"`
	Type  string `json:"Type"`
	Price int    `json:"Price"`
	Owner string `json:"Owner"`
}

// HistoricalAssetRecord contains the mutable details of an asset at a specific point in time.
type HistoricalAssetRecord struct {
	Price int    `json:"Price"`
	Owner string `json:"Owner"`
}

// HistoryQueryResult structure used for returning history query results
type HistoryQueryResult struct {
	Record    *HistoricalAssetRecord `json:"record"`
	TxId      string                 `json:"txId"`
	Timestamp time.Time              `json:"timestamp"`
	IsDelete  bool                   `json:"isDelete"`
}

// InitLedger adds a base set of assets to the ledger
func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	assets := []Asset{
		{ID: "asset1", Type: "Car", Price: 10000, Owner: "Tomoko"},
		{ID: "asset2", Type: "House", Price: 250000, Owner: "Brad"},
		{ID: "asset3", Type: "Boat", Price: 50000, Owner: "Jin Soo"},
	}

	for _, asset := range assets {
		assetJSON, err := json.Marshal(asset)
		if err != nil {
			return err
		}

		err = ctx.GetStub().PutState(asset.ID, assetJSON)
		if err != nil {
			return fmt.Errorf("failed to put to world state. %v", err)
		}
	}

	return nil
}

// CreateAsset issues a new asset to the world state with given details.
func (s *SmartContract) CreateAsset(ctx contractapi.TransactionContextInterface, id string, assetType string, price int, owner string) error {
	exists, err := s.AssetExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("the asset %s already exists", id)
	}

	asset := Asset{
		ID:    id,
		Type:  assetType,
		Price: price,
		Owner: owner,
	}
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, assetJSON)
}

// ReadAsset returns the asset stored in the world state with given id.
func (s *SmartContract) ReadAsset(ctx contractapi.TransactionContextInterface, id string) (*Asset, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if assetJSON == nil {
		return nil, fmt.Errorf("the asset %s does not exist", id)
	}

	var asset Asset
	err = json.Unmarshal(assetJSON, &asset)
	if err != nil {
		return nil, err
	}

	return &asset, nil
}

// SearchAssetByID returns the asset stored in the world state with given id.
func (s *SmartContract) SearchAssetByID(ctx contractapi.TransactionContextInterface, id string) (*Asset, error) {
	return s.ReadAsset(ctx, id)
}

// UpdateAssetPrice updates the price of an existing asset in the world state.
func (s *SmartContract) UpdateAssetPrice(ctx contractapi.TransactionContextInterface, id string, newPrice int) error {
	asset, err := s.ReadAsset(ctx, id)
	if err != nil {
		return err
	}
	
	if asset.Price == newPrice {
		return fmt.Errorf("price is already %d, no update performed", newPrice)
	}

	asset.Price = newPrice
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, assetJSON)
}

// TransferAsset updates the owner of an asset in the world state.
func (s *SmartContract) TransferAsset(ctx contractapi.TransactionContextInterface, id string, newOwner string) error {
	asset, err := s.ReadAsset(ctx, id)
	if err != nil {
		return err
	}

	if asset.Owner == newOwner {
		return fmt.Errorf("asset is already owned by %s, no transfer performed", newOwner)
	}

	asset.Owner = newOwner
	assetJSON, err := json.Marshal(asset)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, assetJSON)
}

// GetAllAssets returns all assets found in the world state.
func (s *SmartContract) GetAllAssets(ctx contractapi.TransactionContextInterface) ([]*Asset, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var assets []*Asset
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var asset Asset
		err = json.Unmarshal(queryResponse.Value, &asset)
		if err != nil {
			return nil, err
		}
		assets = append(assets, &asset)
	}

	return assets, nil
}

// GetAssetHistory returns the chain of custody for an asset since issuance.
func (s *SmartContract) GetAssetHistory(ctx contractapi.TransactionContextInterface, assetID string) ([]HistoryQueryResult, error) {
	log.Printf("GetAssetHistory: ID %v", assetID)

	resultsIterator, err := ctx.GetStub().GetHistoryForKey(assetID)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var records []HistoryQueryResult
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var historicalRecord *HistoricalAssetRecord

		if !response.IsDelete && len(response.Value) > 0 {
			var asset Asset
			err = json.Unmarshal(response.Value, &asset)
			if err != nil {
				return nil, err
			}
			historicalRecord = &HistoricalAssetRecord{
				Price: asset.Price,
				Owner: asset.Owner,
			}
		}

		timestamp, err := ptypes.Timestamp(response.Timestamp)
		if err != nil {
			return nil, err
		}

		record := HistoryQueryResult{
			TxId:      response.TxId,
			Timestamp: timestamp,
			Record:    historicalRecord,
			IsDelete:  response.IsDelete,
		}
		records = append(records, record)
	}

	return records, nil
}

// AssetExists returns true when asset with given ID exists in world state
func (s *SmartContract) AssetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	assetJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return assetJSON != nil, nil
}

func main() {
	assetChaincode, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating asset-transfer-basic chaincode: %v", err)
	}

	if err := assetChaincode.Start(); err != nil {
		log.Panicf("Error starting asset-transfer-basic chaincode: %v", err)
	}
}

