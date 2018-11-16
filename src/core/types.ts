
export const Default: unique symbol = Symbol('[DefaultCommand]');

export type RegisteredCommandHandler = {
    handlerClass: Function; // class constructor
    command: string | typeof Default;
    alias: string | null; // null if command is Default
    methods: Array<RegisteredCommand>;
}

export type RegisteredCommand = {
    target: object; // host class of method
    method: string; // target[method]
    command: string | typeof Default;
    alias: string | null; // null if command is Default
    options: RegisteredCommandOption[];
    descriptor: PropertyDescriptor;
}

export interface ICommandLineApp {
    logLine(message: string): void;
    interactive(): void;
}

export interface ICommandRegistry {
    readonly handlers: Array<RegisteredCommandHandler>;
    readonly commands: Array<RegisteredCommand>;
    readonly reconciledCommands: Map<string, RegisteredCommand>;
    registerHandler(name: string | typeof Default, alias: string | null, handlerClass: Function): void;
    registerCommand(command: string | typeof Default, alias: string | null, options: RegisteredCommandOption[], target: object, method: string, descriptor: PropertyDescriptor): void;
    reconcile(): void;
    hasHandler(handler: Function): boolean;
    resolveCommand(command: string): RegisteredCommand | null;
}

// pascal-case - with numbers - first char can't be number
// valid: a, a-a, a-1, a1-1, a1-111, a-a1 etc
export const CommandNameRegex = /^[a-z]+[a-z0-9]*(-[a-z0-9]+)*$/;

export const Type = Object.freeze({
    Boolean: <1>1,
    Number: <2>2,
    String: <4>4,
    Integer: <8>8,
    Array: <16>16
});

export interface ICommandMetadata {
    name: string;
    alias: string | null;
    options: TCommandOption[];
}

export type TCommandOption = string | { // string as --named-flag
    name?: string; // e.g. --save-dev (pascal-case) must exist if alias does, can exist if flag or positional specified
    alias?: string; // e.g. [ name = --dir, alias = -d ]
    flag?: string; // e.g. -D (only if type is boolean) (case-sensitive - single character a-z A-Z)
    positional?: true; // only if flag not specified - type can't be boolean
    type?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // must be specified unless flag is passed (will default to boolean)
};

export type RegisteredCommandOption = {
    name: string | null;
    alias: string | null;
    flag: string | null;
    positional: boolean;
    type: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

export type DecoratorResult = (target: object, propertyKey: string, descriptor: PropertyDescriptor) => void;

export type TCommandDecorator = {
    (): DecoratorResult;
    (name: string): DecoratorResult;
    (name: string, alias: string): DecoratorResult;
    (options: TCommandOption[]): DecoratorResult;
    (name: string, options: TCommandOption[]): DecoratorResult;
    (name: string, alias: string, options: TCommandOption[]): DecoratorResult;
    Type: typeof Type;
};

export interface ICommandArguments {
    readonly command: RegisteredCommand;
    readonly argv: ReadonlyArray<string>;
    readonly flags: Set<string>;
    readonly options: Map<string | number, string | number | boolean | null>;
    readonly positionals: Array<string | number | boolean | null>;
}
