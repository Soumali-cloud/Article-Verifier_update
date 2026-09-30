import { network as hardhatNetwork } from 'hardhat'

const { ethers } = await hardhatNetwork.connect()
const registry = await ethers.deployContract('FactCheckRegistry')
await registry.waitForDeployment()
const deploymentTransaction = registry.deploymentTransaction()
const receipt = deploymentTransaction ? await deploymentTransaction.wait() : null

const networkInfo = await ethers.provider.getNetwork()
console.log(`FactCheckRegistry deployed at ${await registry.getAddress()}`)
console.log(`Network chain ID: ${networkInfo.chainId}`)
console.log(`Deployment transaction hash: ${deploymentTransaction?.hash || 'Unavailable'}`)
console.log(`Deployment block number: ${receipt?.blockNumber ?? 'Unavailable'}`)
