import { RegisteredCommand, ICommandArguments } from "./types";

// TODO: global flag -Z to signify that cli should operate in non-interactive mode (e.g. when ZenServer is doing "zen create-component" but doesn't specify required name it will 'hang' because...
// ...stdin is waiting for a name to be entered)
// Alternatively, separate top-level args

// TODO: option.required<boolean = default false> - check at the end of parsing to ensure seen.has(every option in command.options[]);

// Examples
// create / c
// create-component / cc
// create-control / ct
// create-service <serviceName>
// create-service <serviceName> --exported --dir ./services/util/
// ng g interface my-interface
// npm config set init-author-name "Stan Lee"
// ng new my-app --prefix yo --style scss --skip-tests --verbose

export class Arguments implements ICommandArguments {

    public readonly command: RegisteredCommand;
    public readonly argv: ReadonlyArray<string>;
    public readonly flags: Set<string>;
    public readonly options: Map<string | number, any>;
    public readonly positionals: Array<any>;

    constructor(
        command: RegisteredCommand,
        argv: ReadonlyArray<string>,
        flags: Set<string>,
        options: Map<string | number, any>,
        positionals: Array<any>) {
        this.command = command; // copy of or readonly? will reference the internal command allowing changes to reflect subsequent command parsing
        this.argv = Object.freeze(Array.from(argv));
        this.flags = flags;
        this.options = options;
        this.positionals = positionals;
        Object.freeze(this);
    }

}
