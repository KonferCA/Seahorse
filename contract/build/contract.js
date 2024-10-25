"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Find all our documentation at https://docs.near.org
const near_sdk_js_1 = require("near-sdk-js");
let DataProviderContract = class DataProviderContract {
    constructor() {
        this.providers = new near_sdk_js_1.LookupMap('p');
        this.providerData = new near_sdk_js_1.LookupMap('d');
    }
    init() {
        near_sdk_js_1.near.log("Initializing contract");
    }
    add_provider({ id, name, valueScore, walletAddress }) {
        near_sdk_js_1.near.log(`Adding provider: ${id}, name: ${name}, valueScore: ${valueScore}, wallet: ${walletAddress}`);
        if (valueScore < 1 || valueScore > 100) {
            near_sdk_js_1.near.log(`Invalid value score: ${valueScore}`);
            throw new Error("Value score must be between 1 and 100");
        }
        const provider = { id, name, valueScore, walletAddress };
        this.providers.set(id, provider);
        this.providerData.set(id, new near_sdk_js_1.Vector(`v_${id}`));
        near_sdk_js_1.near.log(`Successfully added provider ${id}`);
    }
    update_provider_value({ id, valueScore }) {
        near_sdk_js_1.near.log(`Updating provider ${id} value score to ${valueScore}`);
        if (valueScore < 1 || valueScore > 100) {
            near_sdk_js_1.near.log(`Invalid value score: ${valueScore}`);
            throw new Error("Value score must be between 1 and 100");
        }
        const provider = this.providers.get(id);
        if (!provider) {
            near_sdk_js_1.near.log(`Provider ${id} not found`);
            throw new Error("Provider not found");
        }
        provider.valueScore = valueScore;
        this.providers.set(id, provider);
        near_sdk_js_1.near.log(`Successfully updated provider ${id} value score`);
    }
    add_provider_data({ providerId, data }) {
        near_sdk_js_1.near.log(`Starting add_provider_data for provider: ${providerId}`);
        near_sdk_js_1.near.log(`Number of items to add: ${data.length}`);
        const providerDataVector = this.providerData.get(providerId);
        if (!providerDataVector) {
            near_sdk_js_1.near.log(`Provider ${providerId} not found`);
            throw new Error("Provider not found");
        }
        const newVector = new near_sdk_js_1.Vector(`v_${providerId}`);
        for (const item of data) {
            near_sdk_js_1.near.log(`Adding item: ${item.id}, content length: ${item.content.length}`);
            newVector.push(item);
        }
        this.providerData.set(providerId, newVector);
        near_sdk_js_1.near.log(`Successfully added ${data.length} items for provider ${providerId}`);
    }
    remove_provider_data({ providerId, dataIds }) {
        near_sdk_js_1.near.log(`Starting remove_provider_data for provider: ${providerId}`);
        near_sdk_js_1.near.log(`Items to remove: ${dataIds.join(', ')}`);
        const providerDataVector = this.providerData.get(providerId);
        if (!providerDataVector) {
            near_sdk_js_1.near.log(`Provider ${providerId} not found`);
            throw new Error("Provider not found");
        }
        const newData = providerDataVector.toArray().filter(item => !dataIds.includes(item.id));
        near_sdk_js_1.near.log(`Items remaining after filter: ${newData.length}`);
        const newVector = new near_sdk_js_1.Vector(`v_${providerId}`);
        for (const item of newData) {
            near_sdk_js_1.near.log(`Keeping item: ${item.id}`);
            newVector.push(item);
        }
        this.providerData.set(providerId, newVector);
        near_sdk_js_1.near.log(`Successfully removed specified items for provider ${providerId}`);
    }
    process_query({ queryResults }) {
        near_sdk_js_1.near.log(`Starting process_query with ${queryResults.length} results`);
        const payouts = {};
        for (const result of queryResults) {
            near_sdk_js_1.near.log(`Processing result for provider: ${result.providerId}`);
            near_sdk_js_1.near.log(`Relevancy score: ${result.relevancyScore}`);
            const provider = this.providers.get(result.providerId);
            if (!provider) {
                near_sdk_js_1.near.log(`Provider ${result.providerId} not found, skipping`);
                continue;
            }
            near_sdk_js_1.near.log(`Provider ${provider.id} found, value score: ${provider.valueScore}`);
            const payout = BigInt(provider.valueScore) * BigInt(result.relevancyScore) * BigInt(1e17);
            near_sdk_js_1.near.log(`Calculated payout: ${payout} yoctoNEAR`);
            payouts[provider.walletAddress] = (payouts[provider.walletAddress] || BigInt(0)) + payout;
            near_sdk_js_1.near.log(`Updated total payout for ${provider.walletAddress}: ${payouts[provider.walletAddress]} yoctoNEAR`);
        }
        for (const [walletAddress, payout] of Object.entries(payouts)) {
            near_sdk_js_1.near.log(`Processing payout for wallet: ${walletAddress}`);
            near_sdk_js_1.near.log(`Attempting to transfer ${payout} yoctoNEAR to ${walletAddress}`);
            const promiseIndex = near_sdk_js_1.near.promiseBatchCreate(walletAddress);
            near_sdk_js_1.near.promiseBatchActionTransfer(promiseIndex, payout);
            near_sdk_js_1.near.log(`Transfer initiated for ${walletAddress}`);
        }
        near_sdk_js_1.near.log('Query processing completed');
    }
    get_provider({ id }) {
        near_sdk_js_1.near.log(`Getting provider info for: ${id}`);
        const provider = this.providers.get(id);
        if (provider) {
            near_sdk_js_1.near.log(`Found provider: ${provider.name}`);
        }
        else {
            near_sdk_js_1.near.log(`Provider ${id} not found`);
        }
        return provider;
    }
    get_provider_data({ providerId }) {
        near_sdk_js_1.near.log(`Getting data for provider: ${providerId}`);
        const providerDataVector = this.providerData.get(providerId);
        if (providerDataVector) {
            const data = providerDataVector.toArray();
            near_sdk_js_1.near.log(`Found ${data.length} items for provider ${providerId}`);
            return data;
        }
        else {
            near_sdk_js_1.near.log(`No data found for provider ${providerId}`);
            return [];
        }
    }
};
__decorate([
    (0, near_sdk_js_1.initialize)({})
], DataProviderContract.prototype, "init", null);
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "add_provider", null);
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "update_provider_value", null);
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "add_provider_data", null);
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "remove_provider_data", null);
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "process_query", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "get_provider", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "get_provider_data", null);
DataProviderContract = __decorate([
    (0, near_sdk_js_1.NearBindgen)({})
], DataProviderContract);
