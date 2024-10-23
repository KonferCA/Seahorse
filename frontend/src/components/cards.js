import Link from 'next/link';

export const Cards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Link
        href="https://docs.near.org/build/web3-apps/quickstart"
        className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
        target='_blank'
        rel="noopener noreferrer"
      >
        <h2 className="text-xl font-bold mb-2">
          Near Docs <span className="text-blue-500">-&gt;</span>
        </h2>
        <p>Learn how this application works, and what you can build on Near.</p>
      </Link>

      <Link
        href="/hello-near"
        className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow"
        rel="noopener noreferrer"
      >
        <h2 className="text-xl font-bold mb-2">
          Near Integration <span className="text-blue-500">-&gt;</span>
        </h2>
        <p>Discover how simple it is to interact with a Near smart contract.</p>
      </Link>
    </div>
  );
};
