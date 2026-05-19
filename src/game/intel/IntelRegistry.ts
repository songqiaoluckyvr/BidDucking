import type { IIntelOption } from './IIntelOption';

export class IntelRegistry {
  private readonly options = new Map<string, IIntelOption>();

  register(option: IIntelOption): void {
    this.options.set(option.id, option);
  }

  get(id: string): IIntelOption {
    const option = this.options.get(id);
    if (!option) throw new Error(`Intel option not found: ${id}`);
    return option;
  }

  getAll(): IIntelOption[] {
    return Array.from(this.options.values());
  }

  has(id: string): boolean {
    return this.options.has(id);
  }
}
