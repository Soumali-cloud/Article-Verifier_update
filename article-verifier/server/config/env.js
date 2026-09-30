/* global process */
import dotenv from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') })

const placeholderValues = new Set([
  '',
  'your_google_fact_check_api_key_here',
  'your_google_custom_search_api_key_here',
  'your_google_search_engine_id_here',
  'your_llm_api_key_here',
  'your_sepolia_rpc_url',
  'your_backend_wallet_private_key',
  'deployed_contract_address',
  '...'
])

const readOptional = (name) => {
  const value = process.env[name]?.trim() || ''
  return placeholderValues.has(value) ? '' : value
}

export const env = {
  port: Number.parseInt(process.env.PORT || '5000', 10),
  clientOrigin: process.env.CLIENT_ORIGIN?.trim() || 'http://localhost:5173',
  llmProvider: process.env.LLM_PROVIDER?.trim() || '',
  llmModel: process.env.LLM_MODEL?.trim() || '',
  llmApiKey: readOptional('LLM_API_KEY'),
  llmBaseUrl: process.env.LLM_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com/v1beta/openai/',
  blockchainRpcUrl: readOptional('BLOCKCHAIN_RPC_URL'),
  blockchainPrivateKey: readOptional('BLOCKCHAIN_PRIVATE_KEY'),
  factCheckContractAddress: readOptional('FACT_CHECK_CONTRACT_ADDRESS'),
  blockchainChainId: Number.parseInt(process.env.BLOCKCHAIN_CHAIN_ID || '11155111', 10),
  googleFactCheckApiKey: readOptional('GOOGLE_FACT_CHECK_API_KEY'),
  googleCustomSearchApiKey: readOptional('GOOGLE_CUSTOM_SEARCH_API_KEY'),
  googleSearchEngineId: readOptional('GOOGLE_SEARCH_ENGINE_ID')
}

export const hasLlmCredentials = () => Boolean(env.llmProvider && env.llmModel && env.llmApiKey)

export const hasGoogleCredentials = () => Boolean(
  env.googleFactCheckApiKey &&
  env.googleCustomSearchApiKey &&
  env.googleSearchEngineId
)
