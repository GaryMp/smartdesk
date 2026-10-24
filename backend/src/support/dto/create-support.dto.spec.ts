import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSupportDto } from './create-support.dto';

async function errorsFor(payload: Record<string, unknown>) {
  const errors = await validate(plainToInstance(CreateSupportDto, payload));
  return errors.map((error) => error.property);
}

describe('CreateSupportDto', () => {
  it('acepta un asunto y una descripción válidos', async () => {
    await expect(
      errorsFor({ subject: 'Asunto', description: 'Descripción' }),
    ).resolves.toEqual([]);
  });

  it('rechaza campos vacíos o ausentes', async () => {
    await expect(errorsFor({ subject: '', description: '' })).resolves.toEqual([
      'subject',
      'description',
    ]);
    await expect(errorsFor({})).resolves.toEqual(['subject', 'description']);
  });

  it('rechaza valores que no son texto', async () => {
    await expect(
      errorsFor({ subject: 123, description: ['a'] }),
    ).resolves.toEqual(['subject', 'description']);
  });

  it('aplica los límites de 120 y 2000 caracteres', async () => {
    await expect(
      errorsFor({ subject: 'a'.repeat(120), description: 'b'.repeat(2000) }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor({ subject: 'a'.repeat(121), description: 'b'.repeat(2001) }),
    ).resolves.toEqual(['subject', 'description']);
  });
});
