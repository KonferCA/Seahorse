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
        this.friendRequests = new near_sdk_js_1.LookupMap('fr');
        this.sharedKeys = new near_sdk_js_1.LookupMap('sk');
        this.encryptedData = new near_sdk_js_1.LookupMap('ed');
        this.friendRequestKeys = new near_sdk_js_1.Vector('frk');
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
    send_friend_request({ friend_id, public_key, encrypted_key }) {
        const from = near_sdk_js_1.near.predecessorAccountId();
        const requestId = `${from}-${friend_id}`;
        // Store request with encryption data
        this.friendRequests.set(requestId, {
            from,
            to: friend_id,
            publicKey: public_key,
            encryptedKey: encrypted_key,
            status: 'pending'
        });
        this.friendRequestKeys.push(requestId);
    }
    accept_friend_request({ from, public_key, encrypted_key }) {
        const to = near_sdk_js_1.near.predecessorAccountId();
        const requestId = `${from}-${to}`;
        const request = this.friendRequests.get(requestId);
        if (!request || request.status !== 'pending') {
            throw new Error('Invalid friend request');
        }
        // Update request status
        request.status = 'accepted';
        request.recipientKey = public_key;
        request.recipientEncryptedKey = encrypted_key;
        this.friendRequests.set(requestId, request);
        // Store shared keys for both parties
        if (!this.sharedKeys) {
            this.sharedKeys = new near_sdk_js_1.LookupMap('sk');
        }
        // Store sender's key
        let senderKeys = this.sharedKeys.get(from) || new near_sdk_js_1.Vector(`sk_${from}`);
        senderKeys.push({
            friendId: to,
            encryptedKey: request.encryptedKey,
            timestamp: Date.now()
        });
        this.sharedKeys.set(from, senderKeys);
        // Store recipient's key
        let recipientKeys = this.sharedKeys.get(to) || new near_sdk_js_1.Vector(`sk_${to}`);
        recipientKeys.push({
            friendId: from,
            encryptedKey: encrypted_key,
            timestamp: Date.now()
        });
        this.sharedKeys.set(to, recipientKeys);
        near_sdk_js_1.near.log(`Friend request accepted: ${from} -> ${to}`);
    }
    store_encrypted_data({ encryptedData }) {
        const accountId = near_sdk_js_1.near.predecessorAccountId();
        this.encryptedData.set(accountId, encryptedData);
        near_sdk_js_1.near.log(`Stored encrypted data for ${accountId}`);
    }
    get_friend_data({ friendId }) {
        return this.encryptedData.get(friendId);
    }
    get_shared_keys({ accountId }) {
        const keys = this.sharedKeys.get(accountId);
        return keys ? keys.toArray() : [];
    }
    get_pending_friend_requests({ accountId }) {
        const pendingRequests = [];
        near_sdk_js_1.near.log(`Checking pending requests for ${accountId}`);
        // iterate over all keys in the friendRequestKeys vector
        const keys = this.friendRequestKeys.toArray();
        near_sdk_js_1.near.log(`Found ${keys.length} total request keys`);
        for (const key of keys) {
            const request = this.friendRequests.get(key);
            near_sdk_js_1.near.log(`Checking request ${key}: ${JSON.stringify(request)}`);
            // check if the request is pending and for the specified account
            if (request && request.to === accountId && request.status === 'pending') {
                near_sdk_js_1.near.log(`Found pending request for ${accountId} from ${request.from}`);
                pendingRequests.push(request);
            }
        }
        near_sdk_js_1.near.log(`Returning ${pendingRequests.length} pending requests`);
        return pendingRequests;
    }
    get_friends({ accountId }) {
        const friends = [];
        // check all friend requests where this account is involved
        for (const key of this.friendRequestKeys.toArray()) {
            const request = this.friendRequests.get(key);
            if (request && request.status === 'accepted') {
                if (request.from === accountId) {
                    friends.push(request.to);
                }
                else if (request.to === accountId) {
                    friends.push(request.from);
                }
            }
        }
        return friends;
    }
    get_outgoing_requests({ accountId }) {
        const outgoingRequests = [];
        for (const key of this.friendRequestKeys.toArray()) {
            const request = this.friendRequests.get(key);
            if (request && request.from === accountId && request.status === 'pending') {
                outgoingRequests.push(request);
            }
        }
        return outgoingRequests;
    }
    remove_friend({ friendId }) {
        const accountId = near_sdk_js_1.near.predecessorAccountId();
        const requestId1 = `${accountId}-${friendId}`;
        const requestId2 = `${friendId}-${accountId}`;
        // check both possible request combinations
        const request1 = this.friendRequests.get(requestId1);
        const request2 = this.friendRequests.get(requestId2);
        if (request1?.status === 'accepted') {
            request1.status = 'removed';
            this.friendRequests.set(requestId1, request1);
        }
        else if (request2?.status === 'accepted') {
            request2.status = 'removed';
            this.friendRequests.set(requestId2, request2);
        }
        else {
            throw new Error('Friend relationship not found');
        }
        near_sdk_js_1.near.log(`Friend removed: ${friendId}`);
    }
    debug_get_request({ requestId }) {
        return this.friendRequests.get(requestId);
    }
    debug_get_all_keys() {
        return this.friendRequestKeys.toArray();
    }
    debug_get_contract_state() {
        return {
            friendRequestKeys: this.friendRequestKeys.toArray(),
            pendingRequests: this.friendRequestKeys.toArray().map(key => ({
                key,
                request: this.friendRequests.get(key)
            }))
        };
    }
    clear_all_friend_data() {
        // verify caller is the owner of their data
        const caller = near_sdk_js_1.near.predecessorAccountId();
        near_sdk_js_1.near.log(`Clearing all friend data for ${caller}`);
        // clear friend requests
        const requestKeys = this.friendRequestKeys.toArray();
        for (const key of requestKeys) {
            const request = this.friendRequests.get(key);
            if (request && (request.from === caller || request.to === caller)) {
                near_sdk_js_1.near.log(`Removing friend request: ${key}`);
                this.friendRequests.remove(key);
            }
        }
        // clear shared keys
        this.sharedKeys.remove(caller);
        near_sdk_js_1.near.log(`Removed shared keys for ${caller}`);
        // clear encrypted data
        this.encryptedData.remove(caller);
        near_sdk_js_1.near.log(`Removed encrypted data for ${caller}`);
        near_sdk_js_1.near.log(`Successfully cleared all data for ${caller}`);
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
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "send_friend_request", null);
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "accept_friend_request", null);
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "store_encrypted_data", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "get_friend_data", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "get_shared_keys", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "get_pending_friend_requests", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "get_friends", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "get_outgoing_requests", null);
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "remove_friend", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "debug_get_request", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "debug_get_all_keys", null);
__decorate([
    (0, near_sdk_js_1.view)({})
], DataProviderContract.prototype, "debug_get_contract_state", null);
__decorate([
    (0, near_sdk_js_1.call)({})
], DataProviderContract.prototype, "clear_all_friend_data", null);
DataProviderContract = __decorate([
    (0, near_sdk_js_1.NearBindgen)({})
], DataProviderContract);
