import { activity, info, ping, stats } from 'sleetcord-common'
import { autoreply } from './autoreply.js'
import { healthcheck } from './healthcheck.js'

export const miscModules = [activity, autoreply, healthcheck, info, ping, stats]
