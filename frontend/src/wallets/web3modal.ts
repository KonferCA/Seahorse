import { createContext } from 'react';
import { providers } from 'near-api-js';
import '@near-wallet-selector/modal-ui/styles.css';
import { setupModal } from '@near-wallet-selector/modal-ui';
import { setupWalletSelector } from '@near-wallet-selector/core';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import { setupHereWallet } from '@near-wallet-selector/here-wallet';
import { setupLedger } from '@near-wallet-selector/ledger';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { setupSender } from '@near-wallet-selector/sender';
import { setupBitteWallet } from '@near-wallet-selector/bitte-wallet';

export class Wallet {
    selector: any;
    networkId: string;
    createAccessKeyFor: string | undefined;

    constructor({ networkId = 'testnet', createAccessKeyFor = undefined }) {
        this.createAccessKeyFor = createAccessKeyFor;
        this.networkId = networkId;
    }

    startUp = async (accountChangeHook: (account: string) => void) => {
        this.selector = await setupWalletSelector({
            network: this.networkId,
            modules: [
                setupMyNearWallet(),
                setupHereWallet(),
                setupLedger(),
                setupMeteorWallet(),
                setupSender(),
                setupBitteWallet(),
            ],
        });

        const walletSelector = await this.selector;
        const isSignedIn = walletSelector.isSignedIn();
        const accountId = isSignedIn ? walletSelector.store.getState().accounts[0].accountId : '';

        walletSelector.store.observable.subscribe(async (state: any) => {
            const signedAccount = state?.accounts.find((account: any) => account.active)?.accountId;
            accountChangeHook(signedAccount || '');
        });

        return accountId;
    };

    signIn = async () => {
        const modal = setupModal(await this.selector, { contractId: this.createAccessKeyFor });
        modal.show();
    };

    signOut = async () => {
        const selectedWallet = await (await this.selector).wallet();
        selectedWallet.signOut();
    };
}

export const NearContext = createContext<{
    wallet: Wallet | undefined;
    signedAccountId: string;
}>({
    wallet: undefined,
    signedAccountId: '',
});
