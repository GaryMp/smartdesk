import { Test, TestingModule } from '@nestjs/testing';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

describe('SupportController', () => {
  let controller: SupportController;
  let service: { createSupport: jest.Mock };

  beforeEach(async () => {
    service = { createSupport: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportController],
      providers: [{ provide: SupportService, useValue: service }],
    }).compile();

    controller = module.get(SupportController);
  });

  it('delega en SupportService y devuelve su resultado', async () => {
    const dto = { subject: 'Asunto', description: 'Descripción' };
    const result = { analisisIA: { category: 'query' } };
    service.createSupport.mockResolvedValue(result);

    await expect(controller.createSupport(dto)).resolves.toBe(result);
    expect(service.createSupport).toHaveBeenCalledWith(dto);
  });
});
