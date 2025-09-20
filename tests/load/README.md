# Load test

Here we have artifacts to load test yate and confirm it is stable.

## Starting load test

```
./tmux_session.sh
```
The above will start a tmux session running yate, telnet connected to yate, sipp uac and sipp uas.

If desired, you can inspect live calls by opening a new tmux window and doing:
```
sudo sngrep2 -d any
```
However, do not keep it running for very long because it will need to keep all filtered packets in memory and eventually will cause problems.


