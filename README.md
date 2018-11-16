*BuildStatusBadge* *ES6+* *Typescript types* *100% Coverage* *0 Dependencies* *decorators*

# CompositeCLI
CompositeCLI

````sh
npm i composite-cli
````

Import and create a new CLIApplication.
Call `init()` to automatically run the arguments passed in 

````typescript
import { CLIApplication } from 'composite-cli';

// import commands
import './commands';

const app = new CLIApplication();

// then run automatically with process.argv
app.init();
// or
app.runCommand(process.argv.slice(2));

// alternatively, use runCommand
app.runCommand(['my-command', '--option', '-flags', 'value123']);

// commands can be run at any time in the application lifecycle:
setInterval(() => {
    app.runCommand(['check-time']);
}, 5000);

````

Define your `CommandHandlers` and `Commands` using decorators.

````typescript
import { CommandHandler, Command, ICommandArguments, ICLIApplication } from 'composite-cli';

@CommandHandler('post', 'p')
class PostCommandHandler {

    @Command() // fallback/default command invoked via 'post' or 'p'
    post(args: ICommandArguments) {
        console.log('please specify what you want to post');
    }

    @Command('message', 'm', [ // post-message "My message" or pm "My message"
        { name: 'message', positional: true }
    ])
    postMessage(args: ICommandArguments) {
        http.post(`${serviceURL}/message`, { message: args.options.get('message') });
    }

    @Command('file', 'f', [ // post-file ./data.xml or pm ./data.xml
        { name: 'file', alias: 'f', type: Command.Type.String }
    ])
    async postFile(args: ICommandArguments, app: ICLIApplication) {
        const fileData = fs.readFileSync(path.resolve(root, args.options.get('file')));
        const result = await http.post(`${serviceURL}/message`, fileData);
        if (result.success) {
            app.runCommand([ 'pm'/* post-message */, 'data posted successfully' ]);
        } else {
            app.runCommand([ 'pm', 'error posting data' ]);
        }
    }

}

````

