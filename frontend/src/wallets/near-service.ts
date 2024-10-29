import { connect, keyStores, WalletConnection } from 'near-api-js';
import { Provider } from '@services/near/types';

const THREE_HUNDRED_TGAS: bigint = 300000000000000n;

export class NearChatService {
    private wallet!: WalletConnection;
    private contractId: string;

    constructor(contractId: string) {
        this.contractId = contractId;
    }

    async init() {
        const config = {
            networkId: 'testnet', // Prod: mainnet 
            keyStore: new keyStores.BrowserLocalStorageKeyStore(),
            nodeUrl: 'https://rpc.testnet.near.org',
            walletUrl: 'https://wallet.testnet.near.org',
            helperUrl: 'https://helper.testnet.near.org',
            explorerUrl: 'https://explorer.testnet.near.org',
        };

        const near = await connect(config);
        this.wallet = new WalletConnection(near, 'seahorse');
    }

    isSignedIn(): boolean {
        return this.wallet.isSignedIn();
    }

    signIn() {
        this.wallet.requestSignIn({
            contractId: this.contractId,
            methodNames: ['add_provider', 'process_query'],
            keyType: 'ed25519'
        });
    }

    signOut() {
        this.wallet.signOut();
    }

    async registerUser(name: string): Promise<void> {
        if (!this.wallet.isSignedIn()) {
            throw new Error('User must be signed in...');
        }

        const accountId = this.wallet.getAccountId();

        await this.wallet.account().functionCall({
            contractId: this.contractId,
            methodName: 'add_provider',
            args: {
                id: accountId,
                name: name,
                valueScore: 50,
                walletAddress: accountId,
            },
            gas: THREE_HUNDRED_TGAS,
            attachedDeposit: 0n,
        });
    }

    async processQueryPayout(relevancyScore: number): Promise<void> {
        if (!this.wallet.isSignedIn()) {
            throw new Error('User must be signed in...');
        }

        const accountId = this.wallet.getAccountId();

        await this.wallet.account().functionCall({
            contractId: this.contractId,
            methodName: 'process_query',
            args: {
                queryResults: [{
                    providerId: accountId,
                    relevancyScore: relevancyScore,
                }]
            },
            gas: THREE_HUNDRED_TGAS,
            attachedDeposit: 1n,
        });
    }

    async isUserRegistered(): Promise<boolean> {
        if (!this.wallet.isSignedIn()) {
            throw new Error('User must be signed in...');
        }

        try {
            const accountId = this.wallet.getAccountId();
            const provider = await this.wallet.account().viewFunction({
                contractId: this.contractId,
                methodName: 'get_provider',
                args: { id: accountId }
            });

            return provider !== null;
        } catch (error) {
            console.error('Error checking registration:', error);
            return false;
        }
    }

    getAccountId(): string | null {
        return this.wallet.isSignedIn() ? this.wallet.getAccountId() : null;
    }
}