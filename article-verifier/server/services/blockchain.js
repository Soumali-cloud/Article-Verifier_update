import { ethers } from 'ethers'
import artifact from '../../artifacts/contracts/FactCheckRegistry.sol/FactCheckRegistry.json' with { type: 'json' }
import { env } from '../config/env.js'

const verdictEncoding = { UNCERTAIN: 0, REAL: 1, FAKE: 2 }
const explorerByChain = { 11155111: 'https://sepolia.etherscan.io/tx/' }
const networkByChain = { 11155111: 'Sepolia' }

export const isBlockchainConfigured = () => Boolean(env.blockchainRpcUrl && env.blockchainPrivateKey && env.factCheckContractAddress && env.blockchainChainId)
export const encodeVerdict = (verdict) => verdictEncoding[verdict]

const getContext = () => {
  if (!isBlockchainConfigured()) return null
  const provider = new ethers.JsonRpcProvider(env.blockchainRpcUrl, Number(env.blockchainChainId))
  const signer = new ethers.Wallet(env.blockchainPrivateKey, provider)
  return { provider, contract: new ethers.Contract(env.factCheckContractAddress, artifact.abi, signer) }
}

export const registerProof = async (result, resultHash) => {
  if (!isBlockchainConfigured()) return { status: 'NOT_CONFIGURED', resultHash }
  try {
    const { provider, contract } = getContext()
    const existing = await contract.proofs(resultHash)
    if (existing.timestamp > 0n) {
      const network = await provider.getNetwork()
      return { status: 'CONFIRMED', resultHash, transactionHash: null, blockNumber: null, chainId: Number(network.chainId), network: networkByChain[Number(network.chainId)] || 'Unknown network', contractAddress: env.factCheckContractAddress, timestamp: new Date(Number(existing.timestamp) * 1000).toISOString(), duplicate: true }
    }
    const transaction = await contract.registerProof(resultHash, verdictEncoding[result.verdict], result.confidence)
    const receipt = await transaction.wait()
    const network = await provider.getNetwork()
    const block = await provider.getBlock(receipt.blockNumber)
    return { status: 'CONFIRMED', resultHash, transactionHash: receipt.hash, blockNumber: receipt.blockNumber, chainId: Number(network.chainId), network: networkByChain[Number(network.chainId)] || 'Unknown network', contractAddress: env.factCheckContractAddress, timestamp: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null, explorerUrl: explorerByChain[Number(network.chainId)] ? `${explorerByChain[Number(network.chainId)]}${receipt.hash}` : null }
  } catch (error) {
    console.warn('Blockchain proof submission failed:', error.message)
    return { status: 'FAILED', resultHash, error: 'Blockchain proof submission failed.' }
  }
}

export const verifyProof = async (resultHash) => {
  if (!isBlockchainConfigured()) return { verified: false, resultHash, status: 'NOT_CONFIGURED' }
  try {
    const { provider, contract } = getContext()
    const proof = await contract.proofs(resultHash)
    if (proof.timestamp === 0n) return { verified: false, resultHash, status: 'NOT_FOUND' }
    const network = await provider.getNetwork()
    return { verified: true, resultHash, status: 'CONFIRMED', onChain: { verdict: Object.keys(verdictEncoding).find((key) => verdictEncoding[key] === Number(proof.verdict)), confidence: Number(proof.confidence), timestamp: new Date(Number(proof.timestamp) * 1000).toISOString(), submitter: proof.submitter, chainId: Number(network.chainId), network: networkByChain[Number(network.chainId)] || 'Unknown network', contractAddress: env.factCheckContractAddress } }
  } catch {
    return { verified: false, resultHash, status: 'FAILED' }
  }
}
