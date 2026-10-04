/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
use super::paths::{InstalledServer, ServerPaths, OVERRIDE_SERVER_PATH};
use crate::async_pipe::get_socket_name;
use crate::constants::{
	APPLICATION_NAME, EDITOR_WEB_URL, QUALITYLESS_PRODUCT_NAME, QUALITYLESS_SERVER_NAME,
};
use crate::download_cache::DownloadCache;
use crate::log;
use crate::options::{Quality, TelemetryLevel};
use crate::state::LauncherPaths;
use crate::tunnels::paths::{get_server_folder_name, SERVER_FOLDER_NAME};
use crate::update_service::{
	unzip_downloaded_release, Platform, Release, TargetKind, UpdateService,
};
use crate::util::command::{
	capture_command, capture_command_and_check_status, check_output_status, kill_tree,
	new_script_command,
};
use crate::util::errors::{wrap, AnyError, CodeError, ExtensionInstallFailed, WrappedError};
use crate::util::http::{self, BoxedHttp};
use crate::util::io::SilentCopyProgress;
use crate::util::machine::process_exists;
use crate::util::prereqs::skip_requirements_check;
use regex::Regex;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::LazyLock;
use std::time::Duration;
use tokio::fs::remove_file;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::oneshot::Receiver;
use tokio::time::{interval, timeout};

static LISTENING_PORT_RE: LazyLock<Regex> =
	LazyLock::new(|| Regex::new(r"Extension host agent listening on (.+)").unwrap());
static WEB_UI_RE: LazyLock<Regex> =
	LazyLock::new(|| Regex::new(r"Web UI available at (.+)").unwrap());
const AGENT_HOST_BRIDGE_CONNECTION_TOKEN_ENV: &str = "VSCODE_AGENT_HOST_BRIDGE_CONNECTION_TOKEN";

#[derive(Clone, Debug, Default)]
pub struct CodeServerArgs {
	pub host: Option<String>,
	pub port: Option<u16>,
	pub socket_path: Option<String>,

	// common argument
	pub telemetry_level: Option<TelemetryLevel>,
	pub log: Option<log::Level>,
	pub accept_server_license_terms: bool,
	pub verbose: bool,
	pub server_data_dir: Option<String>,
	pub extensions_dir: Option<String>,
	// extension management
	pub install_extensions: Vec<String>,
	pub uninstall_extensions: Vec<String>,
	pub update_extensions: bool,
	pub list_extensions: bool,
	pub show_versions: bool,
	pub category: Option<String>,
	pub pre_release: bool,
	pub donot_include_pack_and_dependencies: bool,
	pub force: bool,
	pub start_server: bool,
	// connection tokens
	pub connection_token: Option<String>,
	pub connection_token_file: Option<String>,
	pub without_connection_token: bool,
	// reconnection
	pub reconnection_grace_time: Option<u32>,
	// agent-host bridge: tells the spawned VS Code server where the
	// canonical agent host is listening so it can register the
	// `agentHostProxy` IPC channel and let renderers reach the agent
	// host over the remote-agent connection. The server does NOT spawn
	// an agent host of its own when these are set.
	pub agent_host_bridge_host: Option<String>,
	pub agent_host_bridge_port: Option<u16>,
	pub agent_host_bridge_connection_token: Option<String>,
	// server acquisition: a VS Code server build on this machine to run
	// directly instead of downloading a server release. Deliberately not
	// part of `command_arguments()` -- the server is given this, not told
	// about it.
	pub local_server: Option<PathBuf>,
}

impl CodeServerArgs {
	pub fn log_level(&self) -> log::Level {
		if self.verbose {
			log::Level::Trace
		} else {
			self.log.unwrap_or(log::Level::Info)
		}
	}

	pub fn telemetry_disabled(&self) -> bool {
		self.telemetry_level == Some(TelemetryLevel::Off)
	}

	pub fn command_arguments(&self) -> Vec<String> {
		let mut args = Vec::new();
		if let Some(i) = &self.socket_path {
			args.push(format!("--socket-path={i}"));
		} else {
			if let Some(i) = &self.host {
				args.push(format!("--host={i}"));
			}
			if let Some(i) = &self.port {
				args.push(format!("--port={i}"));
			}
		}

		if let Some(i) = &self.connection_token {
			args.push(format!("--connection-token={i}"));
		}
		if let Some(i) = &self.connection_token_file {
			args.push(format!("--connection-token-file={i}"));
		}
		if self.without_connection_token {
			args.push(String::from("--without-connection-token"));
		}
		if self.accept_server_license_terms {
			args.push(String::from("--accept-server-license-terms"));
		}
		if let Some(i) = self.telemetry_level {
			args.push(format!("--telemetry-level={i}"));
		}
		if let Some(i) = self.log {
			args.push(format!("--log={i}"));
		}
		if let Some(t) = self.reconnection_grace_time {
			args.push(format!("--reconnection-grace-time={t}"));
		}

		for extension in &self.install_extensions {
			args.push(format!("--install-extension={extension}"));
		}
		if !&self.install_extensions.is_empty() {
			if self.pre_release {
				args.push(String::from("--pre-release"));
			}
			if self.force {
				args.push(String::from("--force"));
			}
		}
		for extension in &self.uninstall_extensions {
			args.push(format!("--uninstall-extension={extension}"));
		}
		if self.update_extensions {
			args.push(String::from("--update-extensions"));
		}
		if self.list_extensions {
			args.push(String::from("--list-extensions"));
			if self.show_versions {
				args.push(String::from("--show-versions"));
			}
			if let Some(i) = &self.category {
				args.push(format!("--category={i}"));
			}
		}
		if let Some(d) = &self.server_data_dir {
			args.push(format!("--server-data-dir={d}"));
		}
		if let Some(d) = &self.extensions_dir {
			args.push(format!("--extensions-dir={d}"));
		}
		if self.start_server {
			args.push(String::from("--start-server"));
		}
		if let Some(port) = self.agent_host_bridge_port {
			args.push(format!("--agent-host-bridge-port={port}"));
			if let Some(host) = &self.agent_host_bridge_host {
				args.push(format!("--agent-host-bridge-host={host}"));
			}
		}
		args
	}

	fn apply_to_command(&self, command: &mut Command) {
		command.args(self.command_arguments());
		if self.agent_host_bridge_port.is_some() {
			if let Some(token) = &self.agent_host_bridge_connection_token {
				command.env(AGENT_HOST_BRIDGE_CONNECTION_TOKEN_ENV, token);
			}
		}
	}
}

/// Base server params that can be `resolve()`d to a `ResolvedServerParams`.
/// Doing so fetches additional information like a commit ID if previously
/// unspecified.
pub struct ServerParamsRaw {
	pub commit_id: Option<String>,
	pub quality: Quality,
	pub code_server_args: CodeServerArgs,
	pub headless: bool,
	pub platform: Platform,
}

/// Server params that can be used to start a VS Code server.
pub struct ResolvedServerParams {
	pub release: Release,
	pub code_server_args: CodeServerArgs,
}

impl ResolvedServerParams {
	fn as_installed_server(&self) -> InstalledServer {
		InstalledServer {
			commit: self.release.commit.clone(),
			quality: self.release.quality,
			headless: self.release.target == TargetKind::Server,
		}
	}

	/// The local server build to run, if the user picked one instead of a
	/// server release.
	pub fn local_server(&self) -> Option<&Path> {
		self.code_server_args.local_server.as_deref()
	}
}

impl ServerParamsRaw {
	pub async fn resolve(
		mut self,
		log: &log::Logger,
		http: BoxedHttp,
	) -> Result<ResolvedServerParams, AnyError> {
		// A local build is its own source of truth: it decides the commit we
		// report and cache state under, so resolve it before anything else and
		// let the commit short-circuit the update service below.
		if let Some(p) = self.code_server_args.local_server.clone() {
			let commit = resolve_local_server_commit(log, &p).await?;
			info!(
				log,
				"Running local {} build at {} (commit {})",
				QUALITYLESS_SERVER_NAME,
				p.display(),
				commit
			);
			self.commit_id = Some(commit);
		}

		Ok(ResolvedServerParams {
			release: self.get_or_fetch_commit_id(log, http).await?,
			code_server_args: self.code_server_args,
		})
	}

	async fn get_or_fetch_commit_id(
		&self,
		log: &log::Logger,
		http: BoxedHttp,
	) -> Result<Release, AnyError> {
		let target = match self.headless {
			true => TargetKind::Server,
			false => TargetKind::Web,
		};

		if let Some(c) = &self.commit_id {
			return Ok(Release {
				commit: c.clone(),
				quality: self.quality,
				target,
				name: String::new(),
				platform: self.platform,
			});
		}

		UpdateService::new(log.clone(), http)
			.get_latest_commit(self.platform, target, self.quality)
			.await
	}
}

/// Resolves which server executable to run outside of a download. The
/// `--server-path` flag (or `VSCODE_CLI_SERVER_PATH`) wins; the compile-time
/// OSS development override is the fallback so existing dev builds keep
/// working. `None` means "download a server release as usual".
pub fn resolve_local_server(explicit: Option<&str>) -> Option<PathBuf> {
	explicit
		.map(PathBuf::from)
		.or_else(|| OVERRIDE_SERVER_PATH.map(PathBuf::from))
}

/// Resolves the identity a local server build is tracked under. The commit is
/// the one the build reports from `--version`, so the editor, the log and pid
/// files, and the "is it already running" check all agree on which build this
/// is. It's prefixed so a local build never shares state -- or a `prune` /
/// `evict` target -- with a downloaded release of the same commit.
async fn resolve_local_server_commit(log: &log::Logger, path: &Path) -> Result<String, AnyError> {
	if !path.is_file() {
		return Err(CodeError::LocalServerNotFound(path.display().to_string()).into());
	}

	match probe_local_server_commit(path).await {
		Some(commit) => Ok(format!("local-{commit}")),
		None => {
			warning!(
				log,
				"Could not read a commit from {} --version; identifying it by path instead",
				path.display()
			);
			Ok(local_server_id(path))
		}
	}
}

/// Reads the commit a server build reports from `--version`. Returns `None` if
/// the build can't be run or doesn't report a usable commit, in which case the
/// caller falls back to identifying the build by path.
async fn probe_local_server_commit(path: &Path) -> Option<String> {
	// Deliberately built the same way as the server itself is launched, so a
	// path pointing at a script (`scripts/code-server.bat`) is probed
	// exactly the way it will later be run.
	let output = new_script_command(path)
		.arg("--version")
		.stdin(std::process::Stdio::null())
		.stdout(std::process::Stdio::piped())
		.stderr(std::process::Stdio::piped())
		.output()
		.await
		.ok()?;

	if !output.status.success() {
		return None;
	}

	parse_version_commit(&String::from_utf8_lossy(&output.stdout)).map(str::to_string)
}

/// Extracts the commit from `--version` output. The message is three lines,
/// version / commit / architecture (see `buildVersionMessage` in
/// `src/vs/platform/environment/node/argv.ts`), but the launcher's own noise
/// can precede it -- the OSS dev script prints `Starting server: ...` and
/// prelaunch chatter first. The architecture is the one line of the three with
/// a fixed, tiny value set, so it anchors the message and the commit is
/// whichever line precedes it.
fn parse_version_commit(stdout: &str) -> Option<&str> {
	let lines: Vec<&str> = stdout.lines().map(str::trim).collect();
	let arch = lines.iter().position(|line| is_known_arch(line))?;
	let commit = lines.get(arch.checked_sub(1)?)?;

	// Guards against placeholders like "Unknown commit", and against a
	// separator that would break the `<quality>-<commit>` cache folder name.
	(!commit.is_empty() && commit.chars().all(is_commit_id_char)).then_some(*commit)
}

fn is_known_arch(line: &str) -> bool {
	matches!(line, "x64" | "arm64" | "arm" | "ia32")
}

fn is_commit_id_char(c: char) -> bool {
	c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-')
}

/// A stable identifier for a local build. Derived from the path so the same
/// build keeps the same log, pid file, and running server check across
/// invocations. Used when the build doesn't report a commit of its own, and
/// by callers that only need to name the build in a log.
pub fn local_server_id(path: &Path) -> String {
	let mut hash = Sha256::new();
	hash.update(path.to_string_lossy().as_bytes());
	format!("local-{:x}", hash.finalize())[..18].to_string()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct UpdateServerVersion {
	pub name: String,
	pub version: String,
	pub product_version: String,
	pub timestamp: i64,
}

/// Code server listening on a port address.
#[derive(Clone)]
pub struct SocketCodeServer {
	pub commit_id: String,
	pub socket: PathBuf,
	pub origin: Arc<CodeServerOrigin>,
}

/// Code server listening on a socket address.
#[derive(Clone)]
pub struct PortCodeServer {
	pub commit_id: String,
	pub port: u16,
	pub origin: Arc<CodeServerOrigin>,
}

/// A server listening on any address/location.
pub enum AnyCodeServer {
	Socket(SocketCodeServer),
	Port(PortCodeServer),
}

pub enum CodeServerOrigin {
	/// A new code server, that opens the barrier when it exits.
	New(Box<Child>),
	/// An existing code server with a PID.
	Existing(u32),
}

impl CodeServerOrigin {
	pub async fn wait_for_exit(&mut self) {
		match self {
			CodeServerOrigin::New(child) => {
				child.wait().await.ok();
			}
			CodeServerOrigin::Existing(pid) => {
				let mut interval = interval(Duration::from_secs(30));
				while process_exists(*pid) {
					interval.tick().await;
				}
			}
		}
	}

	pub async fn kill(&mut self) {
		match self {
			CodeServerOrigin::New(child) => {
				child.kill().await.ok();
			}
			CodeServerOrigin::Existing(pid) => {
				kill_tree(*pid).await.ok();
			}
		}
	}
}

/// Ensures the given list of extensions are installed on the running server.
async fn do_extension_install_on_running_server(
	start_script_path: &Path,
	extensions: &[String],
	log: &log::Logger,
) -> Result<(), AnyError> {
	if extensions.is_empty() {
		return Ok(());
	}

	debug!(log, "Installing extensions...");
	let command = format!(
		"{} {}",
		start_script_path.display(),
		extensions
			.iter()
			.map(|s| get_extensions_flag(s))
			.collect::<Vec<String>>()
			.join(" ")
	);

	let result = capture_command("bash", &["-c", &command]).await?;
	if !result.status.success() {
		Err(AnyError::from(ExtensionInstallFailed(
			String::from_utf8_lossy(&result.stderr).to_string(),
		)))
	} else {
		Ok(())
	}
}

pub struct ServerBuilder<'a> {
	logger: &'a log::Logger,
	server_params: &'a ResolvedServerParams,
	launcher_paths: &'a LauncherPaths,
	server_paths: ServerPaths,
	http: BoxedHttp,
}

/// Ensures the given path has execute permissions on Unix.
/// This is a self-healing measure for cases where the binary was extracted
/// without execute permissions or where permissions were lost (e.g. on
/// network filesystems or after interrupted downloads).
#[cfg(unix)]
fn ensure_executable(path: &std::path::Path) -> Result<(), std::io::Error> {
	use std::os::unix::fs::PermissionsExt;

	let metadata = std::fs::metadata(path)?;
	let mut permissions = metadata.permissions();
	if permissions.mode() & 0o111 == 0 {
		permissions.set_mode(permissions.mode() | 0o111);
		std::fs::set_permissions(path, permissions)?;
	}
	Ok(())
}

#[cfg(not(unix))]
fn ensure_executable(_path: &std::path::Path) -> Result<(), std::io::Error> {
	Ok(())
}

impl<'a> ServerBuilder<'a> {
	pub fn new(
		logger: &'a log::Logger,
		server_params: &'a ResolvedServerParams,
		launcher_paths: &'a LauncherPaths,
		http: BoxedHttp,
	) -> Self {
		let mut server_paths = server_params
			.as_installed_server()
			.server_paths(launcher_paths);

		// A local build keeps the cache-derived folder for its log and pid
		// file, but runs the binary the user pointed us at instead of one
		// from a downloaded release.
		if let Some(p) = server_params.local_server() {
			server_paths.executable = p.to_path_buf();
		}

		Self {
			logger,
			server_params,
			launcher_paths,
			server_paths,
			http,
		}
	}

	/// Gets any already-running server from this directory.
	pub async fn get_running(&self) -> Result<Option<AnyCodeServer>, AnyError> {
		info!(
			self.logger,
			"Checking {} and {} for a running server...",
			self.server_paths.logfile.display(),
			self.server_paths.pidfile.display()
		);

		let pid = match self.server_paths.get_running_pid() {
			Some(pid) => pid,
			None => return Ok(None),
		};
		info!(self.logger, "Found running server (pid={})", pid);
		if !Path::new(&self.server_paths.logfile).exists() {
			warning!(self.logger, "{} Server is running but its logfile is missing. Don't delete the {} Server manually, run the command '{} prune'.", QUALITYLESS_PRODUCT_NAME, QUALITYLESS_PRODUCT_NAME, APPLICATION_NAME);
			return Ok(None);
		}

		do_extension_install_on_running_server(
			&self.server_paths.executable,
			&self.server_params.code_server_args.install_extensions,
			self.logger,
		)
		.await?;

		let origin = Arc::new(CodeServerOrigin::Existing(pid));
		let contents = fs::read_to_string(&self.server_paths.logfile)
			.expect("Something went wrong reading log file");

		if let Some(port) = parse_port_from(&contents) {
			Ok(Some(AnyCodeServer::Port(PortCodeServer {
				commit_id: self.server_params.release.commit.to_owned(),
				port,
				origin,
			})))
		} else if let Some(socket) = parse_socket_from(&contents) {
			Ok(Some(AnyCodeServer::Socket(SocketCodeServer {
				commit_id: self.server_params.release.commit.to_owned(),
				socket,
				origin,
			})))
		} else {
			Ok(None)
		}
	}

	/// Removes a cached server. Local builds are not in the download cache and
	/// are never the user's to delete, so this does nothing for them.
	pub async fn evict(&self) -> Result<(), WrappedError> {
		if self.server_params.local_server().is_some() {
			return Ok(());
		}

		let name = get_server_folder_name(
			self.server_params.release.quality,
			&self.server_params.release.commit,
		);

		self.launcher_paths.server_cache.delete(&name)
	}

	/// Ensures the server is set up in the configured directory.
	pub async fn setup(&self) -> Result<(), AnyError> {
		if let Some(p) = self.server_params.local_server() {
			// The build is already on this machine, so there is nothing to
			// download and unpack -- but the log and pid files still live in
			// the cache-derived folder, so that directory has to exist.
			debug!(
				self.logger,
				"Using local {} build at {}, nothing to download",
				QUALITYLESS_SERVER_NAME,
				p.display()
			);
			return fs::create_dir_all(&self.server_paths.server_dir)
				.map_err(|e| {
					wrap(
						e,
						format!(
							"error creating directory {}",
							self.server_paths.server_dir.display()
						),
					)
				})
				.map_err(AnyError::from);
		}

		debug!(
			self.logger,
			"Installing and setting up {}...", QUALITYLESS_SERVER_NAME
		);

		let update_service = UpdateService::new(self.logger.clone(), self.http.clone());
		let name = get_server_folder_name(
			self.server_params.release.quality,
			&self.server_params.release.commit,
		);

		let result = self
			.launcher_paths
			.server_cache
			.create(name, |target_dir| async move {
				let tmpdir =
					tempfile::tempdir().map_err(|e| wrap(e, "error creating temp download dir"))?;

				let response = update_service
					.get_download_stream(&self.server_params.release)
					.await?;
				let archive_path = tmpdir.path().join(response.url_path_basename().unwrap());

				info!(
					self.logger,
					"Downloading {} server -> {}",
					QUALITYLESS_PRODUCT_NAME,
					archive_path.display()
				);

				http::download_into_file(
					&archive_path,
					self.logger.get_download_logger("server download progress:"),
					response,
				)
				.await?;

				let server_dir = target_dir.join(SERVER_FOLDER_NAME);
				unzip_downloaded_release(
					&archive_path,
					&server_dir,
					self.logger.get_download_logger("server inflate progress:"),
				)?;

				if !skip_requirements_check().await {
					let output = capture_command_and_check_status(
						server_dir
							.join("bin")
							.join(self.server_params.release.quality.server_entrypoint()),
						&["--version"],
					)
					.await
					.map_err(|e| wrap(e, "error checking server integrity"))?;

					trace!(
						self.logger,
						"Server integrity verified, version: {}",
						String::from_utf8_lossy(&output.stdout).replace('\n', " / ")
					);
				} else {
					info!(self.logger, "Skipping server integrity check");
				}

				Ok(())
			})
			.await;

		if let Err(e) = result {
			error!(self.logger, "Error installing server: {}", e);
			return Err(e);
		}

		debug!(self.logger, "Server setup complete");

		Ok(())
	}

	pub async fn listen_on_port(&self, port: u16) -> Result<PortCodeServer, AnyError> {
		let mut cmd = self.get_base_command();
		cmd.arg("--start-server")
			.arg("--enable-remote-auto-shutdown")
			.arg(format!("--port={port}"));

		let child = self.spawn_server_process(cmd).await?;
		let log_file = self.get_logfile()?;
		let plog = self.logger.prefixed(&log::new_code_server_prefix());

		let (mut origin, listen_rx) =
			monitor_server::<PortMatcher, u16>(child, Some(log_file), plog, false);

		let port = match timeout(Duration::from_secs(8), listen_rx).await {
			Err(_) => {
				origin.kill().await;
				return Err(CodeError::ServerOriginTimeout.into());
			}
			Ok(Err(s)) => {
				origin.kill().await;
				return Err(CodeError::ServerUnexpectedExit(format!("{s}")).into());
			}
			Ok(Ok(p)) => p,
		};

		info!(self.logger, "Server started");

		Ok(PortCodeServer {
			commit_id: self.server_params.release.commit.to_owned(),
			port,
			origin: Arc::new(origin),
		})
	}

	/// Runs the command that just installs extensions and exits.
	pub async fn install_extensions(&self) -> Result<(), AnyError> {
		// cmd already has --install-extensions from base
		let mut cmd = self.get_base_command();
		let cmd_str = || {
			self.server_params
				.code_server_args
				.command_arguments()
				.join(" ")
		};

		let r = cmd.output().await.map_err(|e| CodeError::CommandFailed {
			command: cmd_str(),
			code: -1,
			output: e.to_string(),
		})?;

		check_output_status(r, cmd_str)?;

		Ok(())
	}

	pub async fn listen_on_default_socket(&self) -> Result<SocketCodeServer, AnyError> {
		let requested_file = get_socket_name();
		self.listen_on_socket(&requested_file).await
	}

	pub async fn listen_on_socket(&self, socket: &Path) -> Result<SocketCodeServer, AnyError> {
		self._listen_on_socket(socket).await
	}

	async fn _listen_on_socket(&self, socket: &Path) -> Result<SocketCodeServer, AnyError> {
		remove_file(&socket).await.ok(); // ignore any error if it doesn't exist

		let mut cmd = self.get_base_command();
		cmd.arg("--start-server")
			.arg("--enable-remote-auto-shutdown")
			.arg(format!("--socket-path={}", socket.display()));

		let child = self.spawn_server_process(cmd).await?;
		let log_file = self.get_logfile()?;
		let plog = self.logger.prefixed(&log::new_code_server_prefix());

		let (mut origin, listen_rx) =
			monitor_server::<SocketMatcher, PathBuf>(child, Some(log_file), plog, false);

		let socket = match timeout(Duration::from_secs(30), listen_rx).await {
			Err(_) => {
				origin.kill().await;
				return Err(CodeError::ServerOriginTimeout.into());
			}
			Ok(Err(s)) => {
				origin.kill().await;
				return Err(CodeError::ServerUnexpectedExit(format!("{s}")).into());
			}
			Ok(Ok(socket)) => socket,
		};

		info!(self.logger, "Server started");

		Ok(SocketCodeServer {
			commit_id: self.server_params.release.commit.to_owned(),
			socket,
			origin: Arc::new(origin),
		})
	}

	async fn spawn_server_process(&self, mut cmd: Command) -> Result<Child, AnyError> {
		info!(self.logger, "Starting server...");

		debug!(
			self.logger,
			"Starting server process: {:?}",
			cmd.as_std().get_program()
		);

		// On Windows spawning a code-server binary will run cmd.exe /c C:\path\to\code-server.cmd...
		// This spawns a cmd.exe window for the user, which if they close will kill the code-server process
		// and disconnect the tunnel. To prevent this, pass the CREATE_NO_WINDOW flag to the Command
		// only on Windows.
		// Original issue: https://github.com/microsoft/vscode/issues/184058
		// Partial fix: https://github.com/microsoft/vscode/pull/184621
		#[cfg(target_os = "windows")]
		let cmd = cmd.creation_flags(
			winapi::um::winbase::CREATE_NO_WINDOW
				| winapi::um::winbase::CREATE_NEW_PROCESS_GROUP
				| if get_should_use_breakaway_from_job().await {
					winapi::um::winbase::CREATE_BREAKAWAY_FROM_JOB
				} else {
					Default::default()
				},
		);

		// Self-heal: if the server binary lost execute permissions (e.g. on a
		// network filesystem or after a partial extraction), try to restore them
		// before attempting to spawn. If this fails, report it clearly so that
		// the UI does not treat it as generic "corruption" and loop re-downloading.
		if let Err(e) = ensure_executable(&self.server_paths.executable) {
			return Err(CodeError::ServerNotExecutable(format!(
				"{} is not executable and permissions could not be restored: {}",
				self.server_paths.executable.display(),
				e
			))
			.into());
		}

		let child = cmd
			.stderr(std::process::Stdio::piped())
			.stdout(std::process::Stdio::piped())
			.spawn()
			.map_err(|e| CodeError::ServerUnexpectedExit(format!("{e}")))?;

		self.server_paths
			.write_pid(child.id().expect("expected server to have pid"))?;

		Ok(child)
	}

	fn get_logfile(&self) -> Result<File, WrappedError> {
		File::create(&self.server_paths.logfile).map_err(|e| {
			wrap(
				e,
				format!(
					"error creating log file {}",
					self.server_paths.logfile.display()
				),
			)
		})
	}

	fn get_base_command(&self) -> Command {
		let mut cmd = new_script_command(&self.server_paths.executable);
		cmd.stdin(std::process::Stdio::null());
		self.server_params
			.code_server_args
			.apply_to_command(&mut cmd);
		cmd
	}
}

fn monitor_server<M, R>(
	mut child: Child,
	log_file: Option<File>,
	plog: log::Logger,
	write_directly: bool,
) -> (CodeServerOrigin, Receiver<R>)
where
	M: ServerOutputMatcher<R>,
	R: 'static + Send + std::fmt::Debug,
{
	let stdout = child
		.stdout
		.take()
		.expect("child did not have a handle to stdout");

	let stderr = child
		.stderr
		.take()
		.expect("child did not have a handle to stdout");

	let (listen_tx, listen_rx) = tokio::sync::oneshot::channel();

	// Handle stderr and stdout in a separate task. Initially scan lines looking
	// for the listening port. Afterwards, just scan and write out to the file.
	tokio::spawn(async move {
		let mut stdout_reader = BufReader::new(stdout).lines();
		let mut stderr_reader = BufReader::new(stderr).lines();
		let write_line = |line: &str| -> std::io::Result<()> {
			if let Some(mut f) = log_file.as_ref() {
				f.write_all(line.as_bytes())?;
				f.write_all(b"\n")?;
			}
			if write_directly {
				println!("{line}");
			} else {
				trace!(plog, line);
			}
			Ok(())
		};

		loop {
			let line = tokio::select! {
				l = stderr_reader.next_line() => l,
				l = stdout_reader.next_line() => l,
			};

			match line {
				Err(e) => {
					trace!(plog, "error reading from stdout/stderr: {}", e);
					return;
				}
				Ok(None) => break,
				Ok(Some(l)) => {
					write_line(&l).ok();

					if let Some(listen_on) = M::match_line(&l) {
						trace!(plog, "parsed location: {:?}", listen_on);
						listen_tx.send(listen_on).ok();
						break;
					}
				}
			}
		}

		loop {
			let line = tokio::select! {
				l = stderr_reader.next_line() => l,
				l = stdout_reader.next_line() => l,
			};

			match line {
				Err(e) => {
					trace!(plog, "error reading from stdout/stderr: {}", e);
					break;
				}
				Ok(None) => break,
				Ok(Some(l)) => {
					write_line(&l).ok();
				}
			}
		}
	});

	let origin = CodeServerOrigin::New(Box::new(child));
	(origin, listen_rx)
}

fn get_extensions_flag(extension_id: &str) -> String {
	format!("--install-extension={extension_id}")
}

/// A type that can be used to scan stdout from the VS Code server. Returns
/// some other type that, in turn, is returned from starting the server.
pub trait ServerOutputMatcher<R>
where
	R: Send,
{
	fn match_line(line: &str) -> Option<R>;
}

/// Parses a line like "Extension host agent listening on /tmp/foo.sock"
struct SocketMatcher();

impl ServerOutputMatcher<PathBuf> for SocketMatcher {
	fn match_line(line: &str) -> Option<PathBuf> {
		parse_socket_from(line)
	}
}

/// Parses a line like "Extension host agent listening on 9000"
pub struct PortMatcher();

impl ServerOutputMatcher<u16> for PortMatcher {
	fn match_line(line: &str) -> Option<u16> {
		parse_port_from(line)
	}
}

/// Parses a line like "Web UI available at http://localhost:9000/?tkn=..."
pub struct WebUiMatcher();

impl ServerOutputMatcher<reqwest::Url> for WebUiMatcher {
	fn match_line(line: &str) -> Option<reqwest::Url> {
		WEB_UI_RE.captures(line).and_then(|cap| {
			cap.get(1)
				.and_then(|uri| reqwest::Url::parse(uri.as_str()).ok())
		})
	}
}

/// Does not do any parsing and just immediately returns an empty result.
pub struct NoOpMatcher();

impl ServerOutputMatcher<()> for NoOpMatcher {
	fn match_line(_: &str) -> Option<()> {
		Some(())
	}
}

fn parse_socket_from(text: &str) -> Option<PathBuf> {
	LISTENING_PORT_RE
		.captures(text)
		.and_then(|cap| cap.get(1).map(|path| PathBuf::from(path.as_str())))
}

fn parse_port_from(text: &str) -> Option<u16> {
	LISTENING_PORT_RE.captures(text).and_then(|cap| {
		cap.get(1)
			.and_then(|path| path.as_str().parse::<u16>().ok())
	})
}

pub fn get_tunnel_web_url(tunnel_name: &str) -> Option<url::Url> {
	let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from(""));
	let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from(""));

	let dir = if home_dir == current_dir {
		PathBuf::from("")
	} else {
		current_dir
	};

	let base_web_url = EDITOR_WEB_URL?;

	let mut addr = url::Url::parse(base_web_url).unwrap();
	{
		let mut ps = addr.path_segments_mut().unwrap();
		ps.push("tunnel");
		ps.push(tunnel_name);
		for segment in &dir {
			let as_str = segment.to_string_lossy();
			if !(as_str.len() == 1 && as_str.starts_with(std::path::MAIN_SEPARATOR)) {
				ps.push(as_str.as_ref());
			}
		}
	}

	Some(addr)
}

/// Prints the tunnel's ready banner, respecting older singletons without editor access.
pub fn print_listening(log: &log::Logger, tunnel_name: &str, show_editor_link: bool) {
	use crate::commands::output;
	use console::style;

	debug!(
		log,
		"{} is listening for incoming connections", QUALITYLESS_SERVER_NAME
	);

	let addr = match get_tunnel_web_url(tunnel_name) {
		Some(addr) => addr,
		None => return,
	};

	let arrow = style(output::banner_marker()).green().bold();
	let product = QUALITYLESS_PRODUCT_NAME;
	let version = crate::constants::VSCODE_CLI_VERSION.unwrap_or("dev");

	println!();
	println!(
		"  {} {}",
		style(format!("{product} Tunnel")).cyan().bold(),
		style(format!("v{version}")).dim(),
	);
	println!();
	output::print_banner_line("Tunnel", tunnel_name);
	if show_editor_link {
		println!(
			"  {}  {}  {}",
			arrow,
			style("Open:").bold(),
			style(&addr).cyan(),
		);
	}
	output::print_banner_footer();
}

pub async fn download_cli_into_cache(
	cache: &DownloadCache,
	release: &Release,
	update_service: &UpdateService,
) -> Result<PathBuf, AnyError> {
	let cache_name = format!(
		"{}-{}-{}",
		release.quality, release.commit, release.platform
	);
	let cli_dir = cache
		.create(&cache_name, |target_dir| async move {
			let tmpdir =
				tempfile::tempdir().map_err(|e| wrap(e, "error creating temp download dir"))?;
			let response = update_service.get_download_stream(release).await?;

			let name = response.url_path_basename().unwrap();
			let archive_path = tmpdir.path().join(name);
			http::download_into_file(&archive_path, SilentCopyProgress(), response).await?;
			unzip_downloaded_release(&archive_path, &target_dir, SilentCopyProgress())?;
			Ok(())
		})
		.await?;

	let cli = std::fs::read_dir(cli_dir)
		.map_err(|_| CodeError::CorruptDownload("could not read cli folder contents"))?
		.next();

	match cli {
		Some(Ok(cli)) => Ok(cli.path()),
		_ => {
			let _ = cache.delete(&cache_name);
			Err(CodeError::CorruptDownload("cli directory is empty").into())
		}
	}
}

#[cfg(target_os = "windows")]
async fn get_should_use_breakaway_from_job() -> bool {
	let mut cmd = Command::new("cmd");
	cmd.creation_flags(
		winapi::um::winbase::CREATE_NO_WINDOW | winapi::um::winbase::CREATE_BREAKAWAY_FROM_JOB,
	);

	cmd.args(["/C", "echo ok"]).output().await.is_ok()
}

#[cfg(test)]
mod tests {
	use super::*;

	/// An HTTP client that fails every request. Used to assert that a code
	/// path resolves entirely locally and never reaches the update service.
	struct FailingHttp;

	impl FailingHttp {
		fn boxed() -> BoxedHttp {
			Arc::new(FailingHttp)
		}
	}

	impl http::SimpleHttp for FailingHttp {
		fn make_request(
			&self,
			_method: &'static str,
			url: String,
		) -> std::pin::Pin<
			Box<
				dyn std::future::Future<Output = Result<http::SimpleResponse, AnyError>>
					+ Send
					+ '_,
			>,
		> {
			Box::pin(async move { Err(AnyError::from(wrap(url, "unexpected request"))) })
		}
	}

	#[test]
	fn agent_host_bridge_connection_token_is_only_in_command_environment() {
		let args = CodeServerArgs {
			agent_host_bridge_host: Some("127.0.0.1".to_string()),
			agent_host_bridge_port: Some(9000),
			agent_host_bridge_connection_token: Some("secret-token".to_string()),
			..Default::default()
		};
		let mut command = Command::new("code-server");
		args.apply_to_command(&mut command);
		let command = command.as_std();

		assert_eq!(
			(
				command
					.get_args()
					.map(|argument| argument.to_string_lossy().into_owned())
					.collect::<Vec<_>>(),
				command
					.get_envs()
					.map(|(name, value)| (
						name.to_string_lossy().into_owned(),
						value.map(|value| value.to_string_lossy().into_owned())
					))
					.collect::<Vec<_>>(),
			),
			(
				vec![
					"--agent-host-bridge-port=9000".to_string(),
					"--agent-host-bridge-host=127.0.0.1".to_string(),
				],
				vec![(
					AGENT_HOST_BRIDGE_CONNECTION_TOKEN_ENV.to_string(),
					Some("secret-token".to_string()),
				)],
			)
		);
	}

	/// A stand-in for a local server build: an executable script that prints
	/// what `code-server-oss --version` prints, so the commit probe has
	/// something realistic to read.
	/// A stand-in for a local server build: something runnable that prints
	/// what `--version` prints, so the commit probe has something realistic
	/// to read. Uses a script on Windows, because that is the case that needs
	/// the `cmd.exe` wrapping to work at all.
	#[cfg(windows)]
	fn write_fake_server(dir: &Path, version_output: &str) -> PathBuf {
		let path = dir.join("code-server-oss.cmd");
		let body = version_output
			.lines()
			.map(|line| format!("echo {line}\r\n"))
			.collect::<String>();
		std::fs::write(&path, format!("@echo off\r\n{body}")).unwrap();
		path
	}

	#[cfg(unix)]
	fn write_fake_server(dir: &Path, version_output: &str) -> PathBuf {
		use std::os::unix::fs::PermissionsExt;

		let path = dir.join("code-server-oss");
		std::fs::write(
			&path,
			format!("#!/bin/sh\ncat <<'EOF'\n{version_output}\nEOF\n"),
		)
		.unwrap();
		std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
		path
	}

	#[test]
	fn the_version_commit_is_the_line_before_the_architecture() {
		assert_eq!(
			parse_version_commit("1.108.0\nabc123def456\nx64\n"),
			Some("abc123def456")
		);
		// Windows writes \r\n.
		assert_eq!(
			parse_version_commit("1.108.0\r\nabc123def456\r\nx64\r\n"),
			Some("abc123def456")
		);
		// A script that launches the server prints its own line first, which
		// must not shift the version and commit out of place.
		assert_eq!(
			parse_version_commit(
				"Starting server: /out/server-main.js --version\n1.140.0\nabc123def456\nx64\n"
			),
			Some("abc123def456")
		);
	}

	#[test]
	fn a_build_without_a_usable_commit_does_not_report_one() {
		// What an OSS dev build actually prints.
		assert_eq!(
			parse_version_commit(
				"Starting server: /out/server-main.js --version\n1.140.0\nUnknown commit\nx64\n"
			),
			None
		);
		// No architecture line to anchor on, so there is nothing to trust.
		assert_eq!(parse_version_commit("1.108.0\nabc123def456"), None);
		// A separator that would break the `<quality>-<commit>` folder name.
		assert_eq!(parse_version_commit("1.108.0\nabc/123\nx64"), None);
		assert_eq!(parse_version_commit("1.108.0\n\nx64"), None);
		assert_eq!(parse_version_commit(""), None);
	}

	#[tokio::test]
	async fn local_server_commit_comes_from_the_builds_own_version() {
		let dir = tempfile::tempdir().unwrap();
		// The extra leading line is what a wrapper script such as the OSS
		// dev `code-server.bat` prints before the server's own output.
		let path = write_fake_server(
			dir.path(),
			"Starting server: /out/server-main.js --version\n1.108.0\nabc123def456\nx64",
		);

		assert_eq!(
			resolve_local_server_commit(&log::Logger::test(), &path)
				.await
				.unwrap(),
			"local-abc123def456"
		);
	}

	#[tokio::test]
	async fn local_server_commit_falls_back_to_the_path_when_the_build_does_not_report_one() {
		let dir = tempfile::tempdir().unwrap();
		let path = write_fake_server(
			dir.path(),
			"Starting server: /out/server-main.js --version\n1.140.0\nUnknown commit\nx64",
		);

		let commit = resolve_local_server_commit(&log::Logger::test(), &path)
			.await
			.unwrap();
		assert_eq!(
			commit,
			local_server_id(&path),
			"the fallback must be stable for a given path"
		);
	}

	#[tokio::test]
	async fn a_local_server_path_that_does_not_exist_is_an_error() {
		let dir = tempfile::tempdir().unwrap();

		assert!(matches!(
			resolve_local_server_commit(&log::Logger::test(), &dir.path().join("nope")).await,
			Err(AnyError::CodeError(CodeError::LocalServerNotFound(_)))
		));
	}

	#[test]
	fn the_runtime_flag_wins_over_the_build_time_override() {
		assert_eq!(
			resolve_local_server(Some("/opt/builds/mine/code-server-oss")),
			Some(PathBuf::from("/opt/builds/mine/code-server-oss"))
		);
		assert_eq!(
			resolve_local_server(None),
			OVERRIDE_SERVER_PATH.map(PathBuf::from)
		);
	}

	#[tokio::test]
	async fn resolving_local_server_params_does_not_consult_the_update_service() {
		let dir = tempfile::tempdir().unwrap();
		let path = dir.path().join("code-server-oss");
		std::fs::write(&path, "").unwrap();

		// An http client that would fail the test if it were used to look up
		// a commit: a local build already knows its own.
		let params = ServerParamsRaw {
			commit_id: None,
			quality: Quality::Insiders,
			code_server_args: CodeServerArgs {
				local_server: Some(path.clone()),
				..Default::default()
			},
			headless: true,
			platform: Platform::LinuxX64,
		};

		let resolved = params
			.resolve(&log::Logger::test(), FailingHttp::boxed())
			.await
			.unwrap();

		assert_eq!(resolved.local_server(), Some(path.as_path()));
		assert!(resolved.release.commit.starts_with("local-"));
	}

	#[tokio::test]
	async fn setup_of_a_local_server_creates_state_but_downloads_nothing() {
		let dir = tempfile::tempdir().unwrap();
		let launcher_paths = LauncherPaths::new_without_replacements(dir.path().to_path_buf());
		let local = dir.path().join("code-server-oss");
		std::fs::write(&local, "").unwrap();

		let resolved = ResolvedServerParams {
			release: Release {
				commit: "local-deadbeef".to_string(),
				quality: Quality::Insiders,
				target: TargetKind::Server,
				name: String::new(),
				platform: Platform::LinuxX64,
			},
			code_server_args: CodeServerArgs {
				local_server: Some(local.clone()),
				..Default::default()
			},
		};

		let logger = log::Logger::test();
		let builder = ServerBuilder::new(&logger, &resolved, &launcher_paths, FailingHttp::boxed());

		assert_eq!(builder.server_paths.executable, local);
		let server_dir = builder.server_paths.server_dir.clone();
		assert!(!server_dir.exists());

		builder.setup().await.unwrap();

		// The log and pid files live in here, so it has to exist -- otherwise
		// the server starts but its logfile can't be created.
		assert!(server_dir.is_dir());
		// ...but there is no release to unpack into it.
		assert_eq!(
			std::fs::read_dir(&server_dir).unwrap().count(),
			0,
			"nothing should have been downloaded into {}",
			server_dir.display()
		);

		// Evicting must not take the log and pid files with it.
		builder.evict().await.unwrap();
		assert!(server_dir.is_dir());
	}
}
