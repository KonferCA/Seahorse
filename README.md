<div align="center">
  <a href="">
    <img src="https://fontmeme.com/permalink/241028/335056c32fe744ebd9f39e10732099d6.png" alt="graffiti-creator" border="0/>
  </a>
  <p align="center"> <br /><br />
    <a href="https://github.com/KonferCA/Seahorse/tree/main/docs"><strong>Contribute » </strong></a>
  </p>
</div>

## Purpose :pushpin:
Addressing loneliness and mental health by creating online accountability through an AI wellness recommendation engine. This platform guides users in self-care while connecting them in real life to a supportive community of like-minded individuals, fostering in-person accountability and mutual growth.

## Overview :paperclip:
A decentralized Retrieval-Augmented Generation (RAG) system with a blockchain-based compensation model that prioritizes data ownership and privacy. The system processes personal data, such as Google Calendar entries, emails, and transcriptions, entirely on-device using advanced similarity search with all-MiniLM-L6-v2 embeddings. A secure, wallet-based routing system enables two users to exchange decryption keys, allowing access to shared calendar and event data stored encrypted on NEAR Protocol’s blockchain. Compensation for data providers is managed through NEAR smart contracts, which distribute payments based on data relevance scores. Initially centralized for simplicity, the routing system is designed with future decentralization in mind.

This project aims to set new standards in ethical AI by combining privacy-focused, decentralized data processing with a fair, automated compensation structure for data contributors.

## How it works :hammer:
### On-Device System
- On-Device RAG System: An entirely on-device Retrieval-Augmented Generation (RAG) system pulls relevant information from diverse sources.
   - Data Sources: Includes Google Calendar, Gmail emails, uploaded documents, voice transcriptions, and more.
   - Vector Embeddings: Uses all-MiniLM-L6-v2 model to map text into a dense vector space for similarity searches.
   - Flexibility: Designed for plug-and-play functionality to accommodate new information as needed.
- Response Generation: Uses WebLLM to run Phi 3.5 Vision Instruct on-device for responses, pulling only relevant data.
   - Smart Contract Integration: Relevancy scores and data usage are logged for fair compensation calculation. This information is sent to NEAR Protocol, which calculates and distributes payments based on data relevance.
- Voice Transcription: Uses OpenAI Whisper or similar tool for on-device transcription, storing notes locally for user retrieval and RAG system reference.

### Smart Contract System
- Data Management: Data providers manage their information directly on NEAR’s blockchain.
   - Direct Updates: Providers can update, add, or remove data on the blockchain, formatted specifically for the RAG system.
- Compensation Calculation: Smart contract computes compensation based on data type and relevance scores, immediately distributing NEAR tokens to providers’ wallets.
- Encrypted User Data Storage: Stores user information (calendar, documents, etc.) in encrypted form. Decryption occurs solely on-device, enabling private data sharing within the RAG system.
   - Shared Events: Includes multi-user interactions like shared calendar events, enabling better decision-making between parties.

### Secure Routing System for Key Exchange
- Allows two users to establish a secure key exchange to decrypt calendar or event data stored on the NEAR blockchain.
- Mechanism:
   - NEAR Wallet-Based Identification: Each user is identified by their NEAR wallet, establishing a unique route for connection.
   - Key Exchange: Users initiate a key exchange over a secure, temporary routing channel that connects their wallets. Once exchanged, each user holds a key to access shared calendar or event data.
   - Encrypted Storage and Access: After the key exchange, calendar or event data stored on-chain remains encrypted. Only the involved users, who possess the corresponding keys, can decrypt the shared data on-device.
- Centralized Routing with Future Decentralization Potential:
   - Current Setup: The routing system is centrally managed to streamline initial development, with key exchanges handled through secure server channels linked to NEAR wallets.
   - Decentralization Plan: In future iterations, the routing can transition to decentralized protocols (e.g., peer-to-peer or DHT-based systems), allowing users to securely exchange keys without centralized routing.
