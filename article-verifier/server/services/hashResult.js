import { createHash } from 'node:crypto'
import { canonicalJson } from './resultCanonicalizer.js'

export const hashResult = (result) => `0x${createHash('sha256').update(canonicalJson(result), 'utf8').digest('hex')}`
