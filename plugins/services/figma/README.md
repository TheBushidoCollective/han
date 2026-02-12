# Figma

Connect Claude Code to Figma's official MCP server for design-to-code workflows, component access, and design system integration.

**Zero Configuration**: Once enabled in the Figma desktop app, this plugin works instantly - no API keys, no tokens to manage!

## What This Plugin Provides

### MCP Server: figma-desktop

This plugin uses the official [Figma MCP Server](https://developers.figma.com/docs/figma-mcp-server/) to provide direct access to Figma designs with tools for:

- **Frame-to-Code Generation**: Transform Figma frames into production-ready code
- **Design Extraction**: Access variables, components, layout data, and design tokens
- **FigJam Integration**: Retrieve workflow diagrams and architecture documentation
- **Make Resources**: Incorporate code resources from Make files as context
- **Code Connect**: Maintain consistency between generated code and existing component libraries
- **Design System Sync**: Access design system components and variables

### Available Tools

Once installed and enabled, Claude Code gains access to tools for:

#### Design Access

- Access selected Figma frames for code generation
- Extract design tokens and variables
- Read component properties and variants
- Get layout and positioning information

#### Code Generation

- Generate code from Figma frames
- Apply Code Connect mappings
- Use design system components
- Maintain design-code consistency

#### FigJam Resources

- Access FigJam diagrams for context
- Retrieve architecture documentation
- Incorporate workflow diagrams

## Prerequisites

### Required

- **Figma Desktop App**: Latest version with Dev Mode support
- **Figma Plan**: Dev or Full seat on a paid plan (Starter plan limited to 6 tool calls/month)
- **Dev Mode Access**: Ability to switch to Dev Mode (Shift+D)

### Optional

- **Code Connect**: For design system integration
- **Make Files**: For prototype-to-production workflows

## Installation

```bash
han plugin install figma
```

## Setup

### Step 1: Enable Desktop MCP Server in Figma

1. Open the **Figma desktop app** (must be latest version)
2. Open any **Design file**
3. Switch to **Dev Mode** (Shift+D)
4. Locate the **MCP server section** in Dev Mode
5. Click **"Enable desktop MCP server"**

The server will now run locally at `http://127.0.0.1:3845/mcp`

### Step 2: Keep Figma Running

The MCP server only runs while:

- The Figma desktop app is open
- A design file is open
- Dev Mode is enabled

If you close Figma or switch out of Dev Mode, the connection will be lost.

### Step 3: Verify Connection

After enabling the server, Claude Code should automatically detect the Figma MCP server. You can verify by asking:

```
User: What Figma tools are available?

Claude: [Lists available Figma MCP tools and capabilities]
```

## Usage

### Example 1: Generate Code from a Frame

**Using Selection (Recommended)**:

1. Select a frame in Figma
2. In Claude Code:

```
User: Generate React code for the selected Figma frame

Claude: [Uses Figma MCP to access the frame and generate code]
```

**Using Link**:

```
User: Generate code from https://www.figma.com/design/ABC123/File?node-id=1-234

Claude: [Extracts node ID and generates code]
```

### Example 2: Extract Design Tokens

```
User: What color variables are defined in the current Figma file?

Claude: [Uses Figma MCP to list all color variables and their values]
```

### Example 3: Access Component Library

```
User: Show me all button components and their variants from Figma

Claude: [Retrieves component information including properties and variants]
```

### Example 4: Use FigJam for Context

```
User: Get the architecture diagram from this FigJam file: [URL]

Claude: [Accesses FigJam and incorporates diagram context]
```

### Example 5: Design System Integration

```
User: Generate a form using our design system components from Figma

Claude: [Uses Code Connect mappings to generate code with actual components]
```

## Tool Reference

### Design Access Tools

**Access Frames**: Retrieve frame data including layout, content, and styling

**Parameters**:

- Frame selection (via Figma UI) or Figma URL with node ID
- Optional: specific properties to extract

**Extract Variables**: Get design tokens and variables

**Parameters**:

- Variable type (color, number, string, boolean)
- Optional: variable collection filter

**Read Components**: Access component definitions and variants

**Parameters**:

- Component name or ID
- Optional: include variants and properties

### Code Generation Tools

**Generate Code**: Transform Figma frames into code

**Parameters**:

- Frame reference (selection or URL)
- Target framework (React, Vue, etc.)
- Optional: Code Connect mappings

**Apply Code Connect**: Use existing component mappings

**Parameters**:

- Component references
- Code Connect configuration

### FigJam Tools

**Get FigJam Resources**: Retrieve diagrams and documentation

**Parameters**:

- FigJam file URL
- Optional: specific nodes or sections

## Connection Methods

### Selection-Based (Desktop Only)

1. Select frames in Figma
2. Prompt Claude Code
3. MCP automatically accesses selected content

**Advantages**:

- Quick and intuitive
- No need to copy URLs
- Direct access to current selection

**Limitations**:

- Requires desktop app
- Must keep Figma focused

### Link-Based (Desktop or Remote)

1. Copy Figma URL (includes node ID)
2. Share URL with Claude Code
3. MCP extracts and accesses content

**Advantages**:

- Works with remote server option
- Shareable context
- Persistent references

**Limitations**:

- Requires node IDs in URLs
- Manual URL copying

## Rate Limits

- **Starter Plan**: 6 tool calls per month
- **Dev/Full Seat**: Tier 1 REST API rate limits apply

See [Figma API Rate Limits](https://www.figma.com/developers/api#rate-limits) for details.

## Security Considerations

- **Local Server**: Runs on localhost (127.0.0.1:3845)
- **No Token Required**: Desktop server uses Figma app authentication
- **File Access**: Only files you have permission to view in Figma
- **Network**: Server only accessible from your machine
- **Session-Based**: Server stops when Figma closes

## Limitations

- Requires Figma desktop app to remain open
- Dev Mode must be enabled for server to run
- Dev or Full seat required on paid plans (Starter limited)
- Only supports HTTP transport (desktop server)
- No remote server option in this plugin (by design for zero-config)

## Troubleshooting

### Issue: "Cannot connect to Figma MCP server"

**Solution**: Verify the desktop server is enabled:

1. Open Figma desktop app
2. Open a design file
3. Switch to Dev Mode (Shift+D)
4. Check "Enable desktop MCP server" is ON

### Issue: "Connection refused"

**Solution**: Ensure you're using the latest Figma desktop app:

```bash
# Check for updates in Figma app menu
Help → Check for Updates
```

### Issue: Server stops working

**Solution**: The server only runs while:

- Figma desktop app is open
- A design file is open
- Dev Mode is active

Keep Figma open and in Dev Mode during development.

### Issue: "Rate limit exceeded"

**Solution**: Starter plan users are limited to 6 calls/month. Upgrade to Dev or Full seat for higher limits.

### Issue: "No frames found"

**Solution**: When using selection-based access:

1. Select a frame in Figma (not individual elements)
2. Keep Figma as active window
3. Prompt Claude Code immediately

When using link-based access:

1. Ensure URL includes node-id parameter
2. Verify you have access to the file
3. Check file permissions

## Remote Server Option

This plugin uses the **desktop server** for zero-configuration setup. If you prefer the **remote server** (`https://mcp.figma.com/mcp`), you would need:

- Different plugin configuration
- Figma API token
- Network access to Figma's hosted endpoint

The remote server is not included in this plugin to maintain zero-config simplicity.

## Related Plugins

- **react**: React code generation patterns
- **typescript**: TypeScript validation hooks
- **github**: Git-based design system versioning
