// Find all our documentation at https://docs.near.org
import { NearBindgen, near, call, view, initialize, LookupMap, Vector } from 'near-sdk-js';

type Provider = {
  id: string;
  name: string;
  valueScore: number;
  walletAddress: string;
};

type DataItem = {
  id: string;
  content: string;
};

interface FriendRequest {
  from: string;
  to: string;
  publicKey: string;
  encryptedKey: string;
  recipientKey?: string;
  recipientEncryptedKey?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'removed';
}

interface SharedKey {
  friendId: string;
  encryptedKey: string;
  timestamp: number;
}

@NearBindgen({})
class DataProviderContract {
  providers: LookupMap<Provider>;
  providerData: LookupMap<Vector<DataItem>>;
  friendRequests: LookupMap<FriendRequest>;
  sharedKeys: LookupMap<Vector<SharedKey>>;
  encryptedData: LookupMap<string>;
  friendRequestKeys: Vector<string>;

  constructor() {
    this.providers = new LookupMap('p');
    this.providerData = new LookupMap('d');
    this.friendRequests = new LookupMap('fr');
    this.sharedKeys = new LookupMap('sk');
    this.encryptedData = new LookupMap('ed');
    this.friendRequestKeys = new Vector('frk');
  }

  @initialize({})
  init() {
    near.log("Initializing contract");
  }

  @call({})
  add_provider({ id, name, valueScore, walletAddress }: { id: string; name: string; valueScore: number; walletAddress: string }): void {
    near.log(`Adding provider: ${id}, name: ${name}, valueScore: ${valueScore}, wallet: ${walletAddress}`);
    
    if (valueScore < 1 || valueScore > 100) {
      near.log(`Invalid value score: ${valueScore}`);
      throw new Error("Value score must be between 1 and 100");
    }
    
    const provider: Provider = { id, name, valueScore, walletAddress };
    this.providers.set(id, provider);
    this.providerData.set(id, new Vector(`v_${id}`));
    
    near.log(`Successfully added provider ${id}`);
  }

  @call({})
  update_provider_value({ id, valueScore }: { id: string; valueScore: number }): void {
    near.log(`Updating provider ${id} value score to ${valueScore}`);
    
    if (valueScore < 1 || valueScore > 100) {
      near.log(`Invalid value score: ${valueScore}`);
      throw new Error("Value score must be between 1 and 100");
    }
    
    const provider = this.providers.get(id);
    if (!provider) {
      near.log(`Provider ${id} not found`);
      throw new Error("Provider not found");
    }
    
    provider.valueScore = valueScore;
    this.providers.set(id, provider);
    near.log(`Successfully updated provider ${id} value score`);
  }

  @call({})
  add_provider_data({ providerId, data }: { providerId: string; data: DataItem[] }): void {
    near.log(`Starting add_provider_data for provider: ${providerId}`);
    near.log(`Number of items to add: ${data.length}`);
    
    const providerDataVector = this.providerData.get(providerId);
    if (!providerDataVector) {
      near.log(`Provider ${providerId} not found`);
      throw new Error("Provider not found");
    }

    const newVector = new Vector<DataItem>(`v_${providerId}`);
    for (const item of data) {
      near.log(`Adding item: ${item.id}, content length: ${item.content.length}`);
      newVector.push(item);
    }
    
    this.providerData.set(providerId, newVector);
    near.log(`Successfully added ${data.length} items for provider ${providerId}`);
  }

  @call({})
  remove_provider_data({ providerId, dataIds }: { providerId: string; dataIds: string[] }): void {
    near.log(`Starting remove_provider_data for provider: ${providerId}`);
    near.log(`Items to remove: ${dataIds.join(', ')}`);
    
    const providerDataVector = this.providerData.get(providerId);
    if (!providerDataVector) {
      near.log(`Provider ${providerId} not found`);
      throw new Error("Provider not found");
    }
    
    const newData = providerDataVector.toArray().filter(item => !dataIds.includes(item.id));
    near.log(`Items remaining after filter: ${newData.length}`);
    
    const newVector = new Vector<DataItem>(`v_${providerId}`);
    for (const item of newData) {
      near.log(`Keeping item: ${item.id}`);
      newVector.push(item as DataItem);
    }
    
    this.providerData.set(providerId, newVector as Vector<DataItem>);
    near.log(`Successfully removed specified items for provider ${providerId}`);
  }

  @call({})
  process_query({ queryResults }: { queryResults: { providerId: string; relevancyScore: number }[] }): void {
    near.log(`Starting process_query with ${queryResults.length} results`);
    const payouts: { [key: string]: bigint } = {};

    for (const result of queryResults) {
      near.log(`Processing result for provider: ${result.providerId}`);
      near.log(`Relevancy score: ${result.relevancyScore}`);
      
      const provider = this.providers.get(result.providerId);
      if (!provider) {
        near.log(`Provider ${result.providerId} not found, skipping`);
        continue;
      }
      
      near.log(`Provider ${provider.id} found, value score: ${provider.valueScore}`);
      const payout = BigInt(provider.valueScore) * BigInt(result.relevancyScore) * BigInt(1e17);
      near.log(`Calculated payout: ${payout} yoctoNEAR`);
      
      payouts[provider.walletAddress] = (payouts[provider.walletAddress] || BigInt(0)) + payout;
      near.log(`Updated total payout for ${provider.walletAddress}: ${payouts[provider.walletAddress]} yoctoNEAR`);
    }

    for (const [walletAddress, payout] of Object.entries(payouts)) {
      near.log(`Processing payout for wallet: ${walletAddress}`);
      near.log(`Attempting to transfer ${payout} yoctoNEAR to ${walletAddress}`);
      const promiseIndex = near.promiseBatchCreate(walletAddress);
      near.promiseBatchActionTransfer(promiseIndex, payout);
      near.log(`Transfer initiated for ${walletAddress}`);
    }
    
    near.log('Query processing completed');
  }

  @view({})
  get_provider({ id }: { id: string }): Provider | null {
    near.log(`Getting provider info for: ${id}`);
    const provider = this.providers.get(id);
    if (provider) {
      near.log(`Found provider: ${provider.name}`);
    } else {
      near.log(`Provider ${id} not found`);
    }
    return provider;
  }

  @view({})
  get_provider_data({ providerId }: { providerId: string }): DataItem[] {
    near.log(`Getting data for provider: ${providerId}`);
    const providerDataVector = this.providerData.get(providerId);
    if (providerDataVector) {
      const data = providerDataVector.toArray();
      near.log(`Found ${data.length} items for provider ${providerId}`);
      return data;
    } else {
      near.log(`No data found for provider ${providerId}`);
      return [];
    }
  }

  @call({})
  send_friend_request({ friend_id, public_key, encrypted_key }: { friend_id: string, public_key: string, encrypted_key: string }): void {
    const from = near.predecessorAccountId();
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

  @call({})
  accept_friend_request({ from, public_key, encrypted_key }: { from: string, public_key: string, encrypted_key: string }): void {
    const to = near.predecessorAccountId();
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
      this.sharedKeys = new LookupMap('sk');
    }

    // Store sender's key
    let senderKeys = this.sharedKeys.get(from) || new Vector<SharedKey>(`sk_${from}`);
    senderKeys.push({ 
      friendId: to, 
      encryptedKey: request.encryptedKey,
      timestamp: Date.now()
    });
    this.sharedKeys.set(from, senderKeys);

    // Store recipient's key
    let recipientKeys = this.sharedKeys.get(to) || new Vector<SharedKey>(`sk_${to}`);
    recipientKeys.push({ 
      friendId: from, 
      encryptedKey: encrypted_key,
      timestamp: Date.now()
    });
    this.sharedKeys.set(to, recipientKeys);
    
    near.log(`Friend request accepted: ${from} -> ${to}`);
  }

  @call({})
  store_encrypted_data({ encryptedData }: { encryptedData: string }): void {
    const accountId = near.predecessorAccountId();
    this.encryptedData.set(accountId, encryptedData);
    near.log(`Stored encrypted data for ${accountId}`);
  }

  @view({})
  get_friend_data({ friendId }: { friendId: string }): string | null {
    return this.encryptedData.get(friendId);
  }

  @view({})
  get_shared_keys({ accountId }: { accountId: string }): SharedKey[] {
    const keys = this.sharedKeys.get(accountId);
    return keys ? keys.toArray() : [];
  }

  @view({})
  get_pending_friend_requests({ accountId }: { accountId: string }): FriendRequest[] {
    const pendingRequests: FriendRequest[] = [];
    near.log(`Checking pending requests for ${accountId}`);
    
    // iterate over all keys in the friendRequestKeys vector
    const keys = this.friendRequestKeys.toArray();
    near.log(`Found ${keys.length} total request keys`);
    
    for (const key of keys) {
        const request = this.friendRequests.get(key);
        near.log(`Checking request ${key}: ${JSON.stringify(request)}`);
        
        // check if the request is pending and for the specified account
        if (request && request.to === accountId && request.status === 'pending') {
            near.log(`Found pending request for ${accountId} from ${request.from}`);
            pendingRequests.push(request);
        }
    }
    
    near.log(`Returning ${pendingRequests.length} pending requests`);
    return pendingRequests;
  }

  @view({})
  get_friends({ accountId }: { accountId: string }): string[] {
    const friends: string[] = [];
    
    // check all friend requests where this account is involved
    for (const key of this.friendRequestKeys.toArray()) {
      const request = this.friendRequests.get(key);
      if (request && request.status === 'accepted') {
        if (request.from === accountId) {
          friends.push(request.to);
        } else if (request.to === accountId) {
          friends.push(request.from);
        }
      }
    }
    
    return friends;
  }

  @view({})
  get_outgoing_requests({ accountId }: { accountId: string }): FriendRequest[] {
    const outgoingRequests: FriendRequest[] = [];
    
    for (const key of this.friendRequestKeys.toArray()) {
      const request = this.friendRequests.get(key);
      if (request && request.from === accountId && request.status === 'pending') {
        outgoingRequests.push(request);
      }
    }
    
    return outgoingRequests;
  }

  @call({})
  remove_friend({ friendId }: { friendId: string }): void {
    const accountId = near.predecessorAccountId();
    const requestId1 = `${accountId}-${friendId}`;
    const requestId2 = `${friendId}-${accountId}`;
    
    // check both possible request combinations
    const request1 = this.friendRequests.get(requestId1);
    const request2 = this.friendRequests.get(requestId2);
    
    if (request1?.status === 'accepted') {
      request1.status = 'removed';
      this.friendRequests.set(requestId1, request1);
    } else if (request2?.status === 'accepted') {
      request2.status = 'removed';
      this.friendRequests.set(requestId2, request2);
    } else {
      throw new Error('Friend relationship not found');
    }
    
    near.log(`Friend removed: ${friendId}`);
  }

  @view({})
  debug_get_request({ requestId }: { requestId: string }): FriendRequest | null {
    return this.friendRequests.get(requestId);
  }

  @view({})
  debug_get_all_keys(): string[] {
    return this.friendRequestKeys.toArray();
  }

  @view({})
  debug_get_contract_state(): any {
    return {
        friendRequestKeys: this.friendRequestKeys.toArray(),
        pendingRequests: this.friendRequestKeys.toArray().map(key => ({
            key,
            request: this.friendRequests.get(key)
        }))
    };
  }

  @call({})
  clear_all_friend_data(): void {
    // verify caller is the owner of their data
    const caller = near.predecessorAccountId();
    near.log(`Clearing all friend data for ${caller}`);

    // clear friend requests
    const requestKeys = this.friendRequestKeys.toArray();
    for (const key of requestKeys) {
      const request = this.friendRequests.get(key);
      if (request && (request.from === caller || request.to === caller)) {
        near.log(`Removing friend request: ${key}`);
        this.friendRequests.remove(key);
      }
    }

    // clear shared keys
    this.sharedKeys.remove(caller);
    near.log(`Removed shared keys for ${caller}`);

    // clear encrypted data
    this.encryptedData.remove(caller);
    near.log(`Removed encrypted data for ${caller}`);

    near.log(`Successfully cleared all data for ${caller}`);
  }
}