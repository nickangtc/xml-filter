const fs = require('fs');
const { JSDOM } = require('jsdom');
const { document } = (new JSDOM('')).window;
const program = require('commander');
const { prompt } = require('inquirer');
const XmlReader = require('xml-reader');

// writeStream global
let writer = null;


/**
 * Set up inquirer.js for interactive prompts
 */

// Craft questions to present to users
const questions = [
    {
        type: 'input',
        name: 'input_filename',
        message: 'Enter input filename ...'
    },
    {
        type: 'input',
        name: 'output_filename',
        message: 'Enter name you want the output file to have (remember to put the .xml file extension) ...'
    },
    {
        type: 'input',
        name: 'product_tagname',
        message: 'Enter name of the product tag (eg. enter product if tag is <product>) ...'
    },
    {
        type: 'input',
        name: 'id_tagname',
        message: 'Enter name of the id tag (eg. enter g:id if tag is <g:id>) ...'
    },
    {
        type: 'input',
        name: 'ids_to_keep',
        message: 'Enter list of ids in JavaScript array format (eg. [123, 654, 999]) ...'
    }
];

/**
 * Set up commander.js for nicer handling of process.argv
 */
program
    .version('0.0.1')
    .description('Tool to filter XML feeds');

program
    .command('filter') // No need of specifying arguments here
    .alias('f')
    .description('Filter an XML file')
    .action(() => {
        prompt(questions).then(answers => {
            const { output_filename } = answers;
            writer = fs.createWriteStream(output_filename, 'utf8');

            filter(answers);
        })
    });

program.parse(process.argv);

/**
 * ===========================
 * Implementation
 * ===========================
 */
function filter({
    input_filename, 
    output_filename, 
    product_tagname, 
    id_tagname, 
    ids_to_keep
}
) {
    // quick validation
    if (!input_filename ||
        !output_filename || 
        !product_tagname ||
        !id_tagname ||
        !ids_to_keep
    ) {
        console.error('Some fields did not pass validation. Check your inputs and try again!')
        return;
    }

    const filtered = [];

    fs.readFile(`${input_filename}`, 'utf8', (err, xml) => {
        if (err) return console.error(err);

        const reader = XmlReader.create({ stream: true });

        let count = 0;

        reader.on(`tag:${product_tagname}`, (data) => {
            count++;

            if (count % 10000 === 0) {
                console.log('processed', count, `<${product_tagname}>`);
            }

            const entryChildren = data.children;

            entryChildren.forEach((child) => {
                if (child.name === id_tagname) {
                    if (ids_to_keep.includes(child.children[0].value)) {
                        convertEntryNodeObjectToXml(entryChildren, product_tagname);
                    }
                }
            });
        });

        // reader.on('done', (data) => 'DONE!');

        // execute xml parse stream
        reader.parse(xml);
    });
}

let matchCount = 0;

function convertEntryNodeObjectToXml(entryNode, product_tagname) {
    const entryTag = document.createElement(product_tagname);

    matchCount++;

    console.log('found match >> total matches:', matchCount);

    entryNode.forEach((node) => {
        // node is an individual node inside an <entry>, eg. <g:id>

        if (node.type === 'element') {
            const entryChild = document.createElement(node.name);

            if (node.children.length > 0) {
                if (node.children[0].type === 'text') {
                    entryChild.textContent = node.children[0].value;
                }
            }

            if (node.attributes) {
                for (let key in node.attributes) {
                    entryChild.setAttribute(key, node.attributes[key]);
                }
            }

            entryTag.appendChild(entryChild);
        }
    });

    // convert DOM node to string representation
    const tmp = document.createElement("div");
    tmp.appendChild(entryTag);
    // console.log(tmp.innerHTML); // <entry>...</entry>
    writer.write(tmp.innerHTML);

    // explicitly mark for garbage collection
    delete tmp;
    delete entryTag;
}