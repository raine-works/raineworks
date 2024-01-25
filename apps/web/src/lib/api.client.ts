import { edenTreaty } from '@elysiajs/eden'
import type { App } from '../hooks.server'

export const client = edenTreaty<App>('/')
