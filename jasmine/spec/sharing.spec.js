describe('buildCartridge and parseCartridge encoder decoder pair', () => {
  it('encodes and decodes data', () => {
    const expectedObject = {
      key: null,
      options: {},
      program: 'test text'
    };

    const cartridge = buildCartridge('label', expectedObject, null);
    const result = parseCartridge(cartridge);

    expect(result).toEqual(expectedObject);
  });
});
