describe('packOptions', () => {
  it('returns options object with all optionsFlags properties from argument', () => {
    const expectedObject = optionFlags.reduce((obj, flag) => {
      obj[flag] = 'test';
      return obj}, {})

    const objectWithOptionsAndOther = Object.assign({
      should: 'nope',
      not: 'nope',
      show: 'nope',
      up: 'nope',
    }, expectedObject);

    expect(packOptions(objectWithOptionsAndOther)).toEqual(expectedObject);
  })
});