/* global process */
import 'dotenv/config'
import hardhatEthers from '@nomicfoundation/hardhat-ethers'

const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545'
const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || ''

export default {
  plugins: [hardhatEthers],
  solidity: '0.8.24',
  networks: {
    sepolia: {
      type: 'http',
      url: rpcUrl,
      chainId: 11155111,
      accounts: privateKey ? [privateKey] : []
    }
  }
}
