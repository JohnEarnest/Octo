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
  });
});

describe('unpackOptions', () => {
  it('assigns to emulator argument all optionsFlags properties from options argument', () => {
    const expectedObject = optionFlags.reduce((obj, flag) => {
      obj[flag] = 'test';
      return obj}, {})

    const objectWithOptionsAndOther = Object.assign({
      should: 'nope',
      not: 'nope',
      show: 'nope',
      up: 'nope',
    }, expectedObject);

    var emulator = {};

    unpackOptions(emulator, objectWithOptionsAndOther);

    expect(emulator).toEqual(expectedObject);
  });

  it('assigns to emulator maxSize to 65024 if options has enableXO and it is truthy', () => {
    var emulator = {};

    unpackOptions(emulator, {enableXO: true});

    expect(emulator).toEqual({maxSize: 65024});
  });
});

//references emulator.screenRotation global
//references DOM element with id provided
//references scaleFactor global
//references renderTarget global
describe('setRenderTarget', () => {
  let canvas;
  beforeEach(() => {
    emulator.screenRotation = 0;
    scaleFactor = 1;
    renderTarget = 0;
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
  });
  afterEach(() => {
    document.body.removeChild(canvas);
  })
  it('sets scaleFactor global to scale', () => {
    canvas.id = 1;
    
    emulator.screenRotation = 90;

    const expectedScaleFactor = 4;
    setRenderTarget(expectedScaleFactor, canvas.id);

    expect(scaleFactor).toBe(expectedScaleFactor)
  });

  it('sets renderTarget global to canvas id', () => {
    canvas.id = 4;
    emulator.screenRotation = 90;

    setRenderTarget(2, canvas.id);

    expect(renderTarget).toBe(canvas.id)
  });

  it('finds dom element with canvas argument for id.'
  +'When global emulator.screenRotation is 90, sets dom element height to 128 * scale argument and width to 64 * scale argument.', () => {
    canvas.id = 1;
    emulator.screenRotation = 90;

    setRenderTarget(1, canvas.id);

    expect(canvas.height).toBe(128);
    expect(canvas.width).toBe(64);
  });

  it('finds dom element with canvas argument for id.'
  +'When global emulator.screenRotation is 270, sets dom element height to 128 * scale argument and width to 64 * scale argument.', () => {
    canvas.id = 2;
    emulator.screenRotation = 270;

    setRenderTarget(2, canvas.id);

    expect(canvas.height).toBe(256);
    expect(canvas.width).toBe(128);
  });

  it('finds dom element with canvas argument for id.'
  +'When global emulator.screenRotation not 90 or 270, sets dom element height to 64 * scale argument and width to 128 * scale argument.', () => {
    canvas.id = 3;
    emulator.screenRotation = 0;

    setRenderTarget(2, canvas.id);

    expect(canvas.height).toBe(128);
    expect(canvas.width).toBe(256);
  });
});

//references scaleFactor global
//references console.assert global
describe('setTransform', () => {
  beforeEach(() => {
    scaleFactor = 1;
  });
  it('sets the canvas context transform to the identity matrix when the emulator argument has screenRotation of 0', () => {
    const context2d = document.createElement('canvas').getContext('2d');

    var emulator = {
      screenRotation: 0
    };

    context2d.setTransform(2,2,2,2,2,2,2);

    setTransform(emulator, context2d);

    const resultTransform = context2d.getTransform();

    expect(resultTransform.a).toEqual(1);
    expect(resultTransform.b).toEqual(0);
    expect(resultTransform.c).toEqual(0);
    expect(resultTransform.d).toEqual(1);
    expect(resultTransform.e).toEqual(0);
    expect(resultTransform.f).toEqual(0);
  });

  it('sets the canvas context transform to rotate 90 and set the origin in the top left when the emulator argument has screenRotation of 90', () => {
    const context2d = document.createElement('canvas').getContext('2d');

    var emulator = {
      screenRotation: 90
    };

    scaleFactor = 2

    context2d.setTransform(2,2,2,2,2,2,2);

    setTransform(emulator, context2d);

    const resultTransform = context2d.getTransform();

    expect(resultTransform.a).toBeCloseTo(0,10);
    expect(resultTransform.b).toBeCloseTo(1,10);
    expect(resultTransform.c).toBeCloseTo(-1,10);
    expect(resultTransform.d).toBeCloseTo(0,10);
    expect(resultTransform.e).toBeCloseTo(128,10);
    expect(resultTransform.f).toBeCloseTo(0, 10);
  });

  it('sets the canvas context transform to rotate 180 and set the origin in the top left when the emulator argument has screenRotation of 180', () => {
    const context2d = document.createElement('canvas').getContext('2d');

    var emulator = {
      screenRotation: 180
    };

    scaleFactor = 2

    context2d.setTransform(2,2,2,2,2,2,2);

    setTransform(emulator, context2d);

    const resultTransform = context2d.getTransform();

    expect(resultTransform.a).toBeCloseTo(-1,10);
    expect(resultTransform.b).toBeCloseTo(0,10);
    expect(resultTransform.c).toBeCloseTo(0,10);
    expect(resultTransform.d).toBeCloseTo(-1,10);
    expect(resultTransform.e).toBeCloseTo(256,10);
    expect(resultTransform.f).toBeCloseTo(128, 10);
  });

  it('sets the canvas context transform to rotate 270 and set the origin in the top left when the emulator argument has screenRotation of 270', () => {
    const context2d = document.createElement('canvas').getContext('2d');

    var emulator = {
      screenRotation: 270
    };

    scaleFactor = 2

    context2d.setTransform(2,2,2,2,2,2,2);

    setTransform(emulator, context2d);

    const resultTransform = context2d.getTransform();

    expect(resultTransform.a).toBeCloseTo(0,10);
    expect(resultTransform.b).toBeCloseTo(-1,10);
    expect(resultTransform.c).toBeCloseTo(1,10);
    expect(resultTransform.d).toBeCloseTo(0,10);
    expect(resultTransform.e).toBeCloseTo(0,10);
    expect(resultTransform.f).toBeCloseTo(256, 10);
  });

  it('console assert triggers when emulator.screenRotation is not 0, 90, 180, or 270', () => {
    const context2d = document.createElement('canvas').getContext('2d');

    var emulator = {
      screenRotation: 300
    };

    scaleFactor = 2

    const originalConsoleAssert = console.assert;
    const spyOnAssert = jasmine.createSpy();

    console.assert = spyOnAssert;

    context2d.setTransform(2,2,2,2,2,2,2);

    setTransform(emulator, context2d);

    console.assert = originalConsoleAssert;

    expect(spyOnAssert).toHaveBeenCalledWith(false, 'Screen rotation not set to 0, 90, 180, or 270. Treating as 0.');
  });
});