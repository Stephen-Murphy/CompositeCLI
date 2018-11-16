import ArgumentsParser from '../../src/core/ArgumentsParser';
import CommandRegistry from '../../src/core/CommandRegistry';
import { ICommandRegistry, ICommandArguments } from '../../src/core/types';

const mockRegistry = (): ICommandRegistry => {
    return new (<any>CommandRegistry).constructor;
};

describe('ArgumentsParser class', () => {

    it('should accept input on construction', () => {

        const registry: ICommandRegistry = mockRegistry();
        const args: string[] = [];

        let r: ArgumentsParser;
        expect(() => r = new ArgumentsParser(registry, args)).not.toThrow();
        r!;

    });

    it('should parse empty options correctly', () => {

        const registry: ICommandRegistry = mockRegistry();
        const args: string[] = [];

        let r: ArgumentsParser;
        expect(() => r = new ArgumentsParser(registry, args)).not.toThrow();
        r!;

        let a: ICommandArguments;
        expect(() => a = r!.parse()).not.toThrow();
        a!;

    });

});
