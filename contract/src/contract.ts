// Find all our documentation at https://docs.near.org
import { NearBindgen, near, call, view, initialize, LookupMap, Vector } from 'near-sdk-js';

export type Provider = {
    id: string;
    name: string;
    valueScore: number;
    walletAddress: string;
};

export type DataItem = {
    id: string;
    content: string;
};

@NearBindgen({})
class DataProviderContract {
    providers: LookupMap<Provider>;
    providerData: LookupMap<Vector<DataItem>>;

    constructor() {
        this.providers = new LookupMap('p');
        this.providerData = new LookupMap('d');
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
}