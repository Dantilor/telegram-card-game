import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

// IMPORTANT: dynamic import so ipv4first is set before any other module loads
await import('./main.js')
