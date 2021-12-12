# Yate Experiments

## Overview

This repo documents our experiments with Yate (Yet Another Telephony Engine)

## Preparation

### Installation of Yate from source in Ubuntu 20.04
```
sudo apt install build-essential

sudo add-apt-repository ppa:rock-core/qt4
sudo apt update
sudo apt install qt4-dev-tools
 
mkdir -p ~/work/src/svn
cd ~/work/src/svn
mkdir yate
cd yate
svn checkout http://voip.null.ro/svn/yate/trunk
cd trunk

./autogen.sh 
./configure
make
sudo make install-noapi #

# obs: the above installs yate on /usr/local/bin/yate and creates /usr/local/etc/yate/ for configuration files.
# However, in our test we will run yate and folder conf.d inside the yate/trunk build folder.
```
### Preserving Yate svn version
```
takeshi:trunk$ svn info
Path: .
Working Copy Root Path: /mnt/ssd/work/src/svn/yate/trunk
URL: http://voip.null.ro/svn/yate/trunk
Relative URL: ^/trunk
Repository Root: http://voip.null.ro/svn/yate
Repository UUID: acf43c95-373e-0410-b603-e72c3f656dc1
Revision: 6528
Node Kind: directory
Schedule: normal
Last Changed Author: marian
Last Changed Rev: 6528
Last Changed Date: 2021-11-26 03:02:25 +0900 (Fri, 26 Nov 2021)
```

### Enabling extmodule
```
cp conf.d/* ~/work/src/svn/yate/trunk/conf.d/
```

### Starting yate (from build folder)
```
./run -vvvvvv
```

### Running tests

First install node modules
```
npm install
```

Inside folder tests there will be subfolders like simple, register etc.

Each subfolder does a test with yate.

To run a test, do:
```
cd TEST_FOLDER
node test.js
```
