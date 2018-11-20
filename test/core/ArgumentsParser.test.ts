import ArgumentsParser from '../../src/core/ArgumentsParser';
import CommandRegistry from '../../src/core/CommandRegistry';
import { ICommandArguments } from '../../src/core/types';


describe('ArgumentsParser', () => {

    it('should fail when a default command is not loaded', () => {

        CommandRegistry.reset(true);
        delete require.cache[require.resolve('../../src/examples/index')];

        const arg = new ArgumentsParser(CommandRegistry, []);
        expect(() => arg.parse()).toThrow();

    });

    it('should parse empty options', () => {

        CommandRegistry.reset(true);
        delete require.cache[require.resolve('../../src/examples/index')];
        const e = require('../../src/examples/index');

        const args: string[] = [];

        let r: ArgumentsParser;
        expect(() => r = new ArgumentsParser(CommandRegistry, args)).not.toThrow();
        r!;

        let a: ICommandArguments;
        expect(() => a = r!.parse()).not.toThrow();
        expect(a!.command.descriptor.value).toBe(e.Example.prototype.defaultCommand);

    });

    it('should parse and resolve expected command', () => {

        // 

    });

});
