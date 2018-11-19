import { CommandHandler, Command, ICommandArguments, ICommandLineApp, CommandLineApp } from '../';
import kindOf from 'kind-of';


@CommandHandler()
export class Example {

    @Command()
    defaultCommand(args: ICommandArguments) {
        console.log('running defaultCommand');
        console.assert(args.options.size === 0);
    }

    @Command('test')
    testCommand(args: ICommandArguments, app: ICommandLineApp) {
        console.log('running testCommand');
        args;
        app.runCommand([]);
        app.runCommand(['main']);
        app.runCommand(['secondary']);
        app.runCommand(['options', '--one']);
        app.runCommand(['flags', '-o']);
        app.runCommand(['rich', '--ref', 'test']);
    }

    @Command('main')
    mainCommand(args: ICommandArguments) {
        console.log('running mainCommand');
        console.assert(args.command.command === 'main' && args.options.size === 0);
    }

    @Command('secondary', 's')
    secondaryCommand(args: ICommandArguments) {
        console.log('running secondaryCommand');
        console.assert(args.command.command === 'secondary' &&
            args.command.alias === 's' &&
            args.options.size === 0);
    }

    @Command('options', 'o', [
        { name: 'one', alias: 'o', type: Command.Type.Boolean }
    ])
    commandWithOptions(args: ICommandArguments) {
        console.log('running commandWithOptions');
        console.assert(args.options.size === 2 || args.options.size === 0); // includes alias
    }

    @Command('flags', 'f', [
        { name: 'one', flag: 'o' }
    ])
    commandWithFlag(args: ICommandArguments) {
        console.log('running commandWithFlag');
        console.assert(args.flags.has('o'), 'didnt have -o');
    }

    @Command('rich', [
        { name: 'ref', alias: 'r', type: Command.Type.Function | Command.Type.Array | Command.Type.Object | Command.Type.String }
    ])
    richContentCommand(args: ICommandArguments, app: ICommandLineApp) {
        console.log('running richContentCommand');
        const value = args.options.get('ref');
        if (kindOf(value) === 'string') {
            if (value === 'test') {
                console.log('got test');
                app.runCommand(['rich', '--ref', this.richContentCommand]);
            } else {
                throw new Error();
            }
        } else if (kindOf(value) === 'function') {
            console.log('got function');
            if ((<any>value) !== this.richContentCommand) throw new Error();
            app.runCommand(['rich', '--ref', [1, 2, 3]]);
        } else if (kindOf(value) === 'array') {
            console.log('got array');
            app.runCommand(['rich', '--ref', { test: 123 }]);
        } else if (kindOf(value) === 'object') {
            console.log('got object');
        }
    }

}

const app = new CommandLineApp();
app.runCommand();
