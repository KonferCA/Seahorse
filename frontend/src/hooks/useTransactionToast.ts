import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { providers, utils } from 'near-api-js';
import { NetworkId } from '@/config';
import toast from 'react-hot-toast';

interface TransactionOutcome {
  status: {
    SuccessValue?: string;
    Failure?: any;
  };
  transaction: {
    actions: {
      FunctionCall?: {
        method_name: string;
        args: string;
        deposit?: string;
      };
      Transfer?: {
        deposit: string;
      };
    }[];
    receiver_id: string;
    signer_id: string;
  };
  transaction_outcome: {
    outcome: {
      executor_id: string;
      gas_burnt: number;
    };
  };
}

// helper to get custom message based on contract method
const getCustomMessage = (methodName: string, args: any, contractId: string): string => {
  switch (methodName) {
    // provider management
    case 'add_provider':
      return `Added new provider: ${args.name} (ID: ${args.id})
Value Score: ${args.valueScore}`;
    
    case 'update_provider_value':
      return `Updated provider ${args.id} value score to ${args.valueScore}`;
    
    case 'remove_provider':
      return `Removed provider ${args.id} and all associated data`;

    // data management
    case 'add_provider_data':
      return `Added ${args.data.length} new data items to provider ${args.providerId}`;
    
    case 'remove_provider_data':
      return `Removed ${args.dataIds.length} items from provider ${args.providerId}`;

    // query processing
    case 'process_query':
      const resultCount = args.queryResults?.length || 0;
      return `Processed query with ${resultCount} results
Distributed rewards to relevant providers`;

    // initialization
    case 'init':
      return `Initialized contract ${contractId}`;

    // fallback for unknown methods
    default:
      return `Called method: ${methodName} on ${contractId}`;
  }
};

// helper to format near amount
const formatNearAmount = (amount: string): string => {
  try {
    return `${utils.format.formatNearAmount(amount)} Ⓝ`;
  } catch {
    return amount;
  }
};

export function useTransactionToast() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const txHash = searchParams.get('transactionHashes');
    if (!txHash) return;

    const fetchTransaction = async () => {
      const toastId = toast.loading('Processing transaction...');
      
      try {
        const provider = new providers.JsonRpcProvider({
          url: `https://rpc.${NetworkId}.near.org`
        });

        const txStatus = await provider.txStatus(txHash, 'unnused');
        const gasUsed = txStatus.transaction_outcome.outcome.gas_burnt / 1e12;
        
        if (txStatus.status.SuccessValue !== undefined) {
          const action = txStatus.transaction.actions[0];
          let message: string;
          let details = '';

          // handle different action types
          if (action.FunctionCall) {
            const args = JSON.parse(Buffer.from(action.FunctionCall.args, 'base64').toString());
            message = getCustomMessage(
              action.FunctionCall.method_name, 
              args,
              txStatus.transaction.receiver_id
            );
            
            if (action.FunctionCall.deposit) {
              details += `Deposit: ${formatNearAmount(action.FunctionCall.deposit)}\n`;
            }
          } else if (action.Transfer) {
            message = `Transferred ${formatNearAmount(action.Transfer.deposit)}`;
            details += `To: ${txStatus.transaction.receiver_id}\n`;
          } else {
            message = 'Transaction successful';
          }

          toast.success(message, {
            id: toastId,
            duration: 5000,
            description: details
          });
        } else if (txStatus.status.Failure) {
          const errorMessage = typeof txStatus.status.Failure === 'string' 
            ? txStatus.status.Failure 
            : JSON.stringify(txStatus.status.Failure, null, 2);

          toast.error('Transaction failed', {
            id: toastId,
            description: `Error: ${errorMessage}\nContract: ${txStatus.transaction.receiver_id}`
          });
        }
      } catch (error) {
        console.error('Error fetching transaction:', error);
        toast.error('Error fetching transaction details', {
          id: toastId,
          description: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    fetchTransaction();
  }, [searchParams]);

  return { toast };
} 