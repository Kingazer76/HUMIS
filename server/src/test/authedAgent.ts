import request from 'supertest'
import type { Express } from 'express'

export const TEST_PASSWORD = 'FarmWater-92'
export const TEST_EMAIL = 'vitest-farmer@humis.test'

export async function createAuthedAgent(app: Express) {
  const agent = request.agent(app)
  const login = await agent.post('/api/auth/login').send({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  })
  if (login.status === 200) return agent
  const created = await agent.post('/api/auth/register').send({
    fullName: 'Vitest Farmer',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
    farmName: 'HUMIS Test Farm',
  })
  if (created.status !== 201) {
    throw new Error(`test register failed: ${created.status} ${JSON.stringify(created.body)}`)
  }
  return agent
}
