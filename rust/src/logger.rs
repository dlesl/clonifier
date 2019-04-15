use web_sys::console;
use log::{Level, LevelFilter, Log, Metadata, Record, SetLoggerError};
use crate::logMessage;

pub struct Logger;

static LOGGER: Logger = Logger;

impl Log for Logger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Trace
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            logMessage(format!("{}", record.level()), format!("{}", record.args()));
            let msg = format!("{} - {}", record.level(), record.args());
            console::log_1(&msg.into());
        }
    }

    fn flush(&self) {}
}

impl Logger {
    pub fn init() -> Result<(), SetLoggerError> {
        let level = LevelFilter::Trace;
        log::set_logger(&LOGGER).map(|()| log::set_max_level(level))
    }
}
